let width = 800;
let height = 400;
let margin = { top: 20, right: 30, bottom: 50, left: 70 };

let svg = d3.select("#chart")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("position", "absolute")
  .style("visibility", "hidden")
  .style("background-color", "#fff")
  .style("border", "1px solid #ccc")
  .style("padding", "5px")
  .style("border-radius", "3px");

// Filteroptionen
let currentGenderFilter = "both";  // "both", "M" oder "F"

// Dropdown-Eventlistener
d3.select("#gender-select").on("change", function () {
  currentGenderFilter = this.value; // Aktualisiere Filter basierend auf Dropdown-Wert
  updateVisualization();
});

// Globale Datenvariable
let data = [];

// CSV laden und Daten aggregieren
d3.dsv(",", "../../data/processed_data.csv")
  .then(loadedData => {
    console.log("Geladene Daten:", loadedData); // Debugging: Prüfe die Struktur der geladenen Daten
    
    // Aggregierte Zählung für Männer und Frauen pro Jahr
    const aggregatedData = d3.rollups(
      loadedData,  // Keine Duplikate entfernen, alle Ausstellungen werden berücksichtigt
      exhibitions => {
        const maleSet = new Set();
        const femaleSet = new Set();

        // Iteriere durch alle Ausstellungen und prüfe die beteiligten Künstler
        exhibitions.forEach(d => {
          const eId = d['e.id'];  // Eindeutige Ausstellungs-ID
          const gender = d['a.gender'];  // Geschlecht des Künstlers

          // Falls der Künstler männlich ist, füge die Ausstellung zu maleSet hinzu
          if (gender === 'M') {
            maleSet.add(eId);
          }
          // Falls der Künstler weiblich ist, füge die Ausstellung zu femaleSet hinzu
          if (gender === 'F') {
            femaleSet.add(eId);
          }
        });

        // Aggregiere Ausstellungen pro Jahr
        return {
          male: maleSet.size,  // Männliche Ausstellungen
          female: femaleSet.size,  // Weibliche Ausstellungen
        };
      },
      d => new Date(d['e.startdate']).getFullYear()  // Gruppierung nach Jahr
    );

    // Aggregierte Daten ins gewünschte Format bringen
    data = aggregatedData.map(([year, values]) => ({
      year: year,
      male: values.male,  // Männliche Ausstellungen
      female: values.female,  // Weibliche Ausstellungen
    }));

    // Jahre aufsteigend sortieren
    data.sort((a, b) => a.year - b.year);

    console.log("Aggregierte Daten:", data); // Debugging: Prüfe, ob die Daten korrekt aggregiert wurden

    // Skalen einrichten
    xScale.domain(data.map(d => d.year));
    yScale.domain([0, d3.max(data, d => Math.max(d.male, d.female))]).nice();

    // Achsen zeichnen
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale));

    svg.append("g")
      .call(d3.axisLeft(yScale));

    // Achsenbeschriftungen
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height + margin.bottom - 10)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-family", "Arial")
      .text("Year");

    svg.append("text")
      .attr("x", -height / 2)
      .attr("y", -margin.left + 20)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-family", "Arial")
      .text("Number of Exhibitions");

    // Visualisierung initialisieren
    updateVisualization();
  })
  .catch(error => {
    console.error("Fehler beim Laden der CSV:", error);
  });

// Skalen für das Diagramm
const xScale = d3.scaleBand()
  .range([0, width])
  .padding(0.1);

const yScale = d3.scaleLinear()
  .range([height, 0]);

// Visualisierung aktualisieren
function updateVisualization() {
  // Debugging: Ausgabe der aktuellen Filtereinstellungen
  console.log("Aktueller Filter:", currentGenderFilter);

  // Daten filtern basierend auf Geschlechtsauswahl
  const filteredData = data.map(d => ({
    year: d.year,
    male: currentGenderFilter === "F" ? 0 : d.male, // Männer nur zählen, wenn der Filter nicht "F" ist
    female: currentGenderFilter === "M" ? 0 : d.female, // Frauen nur zählen, wenn der Filter nicht "M" ist
  }));

  console.log("Gefilterte Daten:", filteredData); // Debugging: Prüfe die gefilterten Daten

  // Daten binden und Gruppen für jedes Jahr erstellen
  const bars = svg.selectAll(".bar-group")
    .data(filteredData, d => d.year);

  // Entferne alte Gruppen
  bars.exit().remove();

  // Füge neue Gruppen hinzu
  const barsEnter = bars.enter()
    .append("g")
    .attr("class", "bar-group")
    .attr("transform", d => `translate(${xScale(d.year)}, 0)`);

  // Männliche Balken
  barsEnter.append("rect")
    .merge(bars.select(".male-bar"))
    .attr("class", "male-bar")
    .attr("x", 0)
    .attr("y", d => yScale(d.male))
    .attr("width", xScale.bandwidth() / 3)
    .attr("height", d => height - yScale(d.male))
    .attr("fill", "#1e81b0")
    .on("mouseover", (event, d) => {
      tooltip.style("visibility", "visible")
        .html(`Year: ${d.year}<br>Exhibitions with Male Participants: ${d.male}`);
    })
    .on("mousemove", event => {
      tooltip.style("top", (event.pageY + 5) + "px")
        .style("left", (event.pageX + 5) + "px");
    })
    .on("mouseout", () => tooltip.style("visibility", "hidden"));

  // Weibliche Balken
  barsEnter.append("rect")
    .merge(bars.select(".female-bar"))
    .attr("class", "female-bar")
    .attr("x", xScale.bandwidth() / 3)
    .attr("y", d => yScale(d.female))
    .attr("width", xScale.bandwidth() / 3)
    .attr("height", d => height - yScale(d.female))
    .attr("fill", "#f1a7c1")
    .on("mouseover", (event, d) => {
      tooltip.style("visibility", "visible")
        .html(`Year: ${d.year}<br>Exhibitions with Female Participants: ${d.female}`);
    })
    .on("mousemove", event => {
      tooltip.style("top", (event.pageY + 5) + "px")
        .style("left", (event.pageX + 5) + "px");
    })
    .on("mouseout", () => tooltip.style("visibility", "hidden"));
}
