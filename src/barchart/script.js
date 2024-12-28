// SVG-Canvas und Tooltip für Interaktionen
const width = 800;
const height = 400;
const margin = { top: 20, right: 30, bottom: 40, left: 50 };

const svg = d3.select("#chart")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left}, ${margin.top})`);

const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("position", "absolute")
  .style("visibility", "hidden")
  .style("background-color", "#fff")
  .style("border", "1px solid #ccc")
  .style("padding", "5px")
  .style("border-radius", "3px");

// Globale Variablen für Filter
let globalData = [];
let currentFilters = {
  year: null,
  gender: "both" // Default: beide Geschlechter anzeigen
};

// Daten laden
d3.dsv(",", "../../data/processed_data.csv").then(data => {
  console.log("Loaded CSV Data:", data);

  // Daten validieren und vorbereiten
  globalData = data.map(d => {
    const year = +d["e.startdate"];
    const gender = d["a.gender"];
    
    // Nur gültige Daten behalten (kein NaN für Jahr, und nur "M" oder "F" für Geschlecht)
    if (!isNaN(year) && (gender === "M" || gender === "F")) {
      return {
        e_startdate: year,  // Jahr der Ausstellung
        a_gender: gender,   // Geschlecht des Künstlers
        e_id: d["e.id"]     // Eindeutige ID der Ausstellung
      };
    }
    return null; // Ungültige Daten filtern
  }).filter(d => d !== null); // Entferne ungültige Daten

  console.log("Mapped Global Data:", globalData);

  updateVisualization(globalData);
}).catch(error => {
  console.error("Error loading CSV:", error);
});

// Event-Listener für Jahrenslider
d3.select("#year-slider").on("input", function () {
  currentFilters.year = +this.value;
  d3.select("#year-display").text(currentFilters.year);
  updateVisualization(globalData);
});

// Event-Listener für Geschlechtsfilter
d3.select("#gender-select").on("change", function () {
  currentFilters.gender = this.value;
  updateVisualization(globalData);
});

// Funktion zur Aktualisierung der Visualisierung
function updateVisualization(data) {
  let filteredData;

  // Wenn kein Jahr ausgewählt, zeige alle Jahre an
  if (currentFilters.year === null) {
    filteredData = data; // Alle Daten anzeigen
  } else {
    // Filtere nur das ausgewählte Jahr
    filteredData = data.filter(d => d.e_startdate === currentFilters.year);
  }

  // Filtere nach Geschlecht, falls nicht "beide" ausgewählt
  if (currentFilters.gender !== "both") {
    filteredData = filteredData.filter(d => d.a_gender === currentFilters.gender);
  }

  console.log("Filtered Data:", filteredData);

  // Gruppiere nach Jahr und Geschlecht, zähle die einzigartigen Ausstellungen für jedes Jahr und Geschlecht
  const aggregatedData = d3.group(filteredData, 
    d => d.e_startdate,  // Gruppiere nach Jahr
    d => d.a_gender       // Gruppiere nach Geschlecht
  );

  console.log("Aggregated Data:", aggregatedData);

  // Dynamisch den Jahresbereich bestimmen
  const years = Array.from(aggregatedData.keys());
  const minYear = d3.min(years);
  const maxYear = d3.max(years);

  const yearData = [];
  if (currentFilters.year === null) {
    // Zeige alle Jahre an
    for (let year = minYear; year <= maxYear; year++) {
      const genderData = aggregatedData.get(year) || new Map();
      const maleExhibitions = genderData.get("M") ? new Set(genderData.get("M").map(d => d.e_id)) : new Set();
      const femaleExhibitions = genderData.get("F") ? new Set(genderData.get("F").map(d => d.e_id)) : new Set();

      yearData.push({
        year,
        male: maleExhibitions.size,   // Zähle die einzigartigen männlichen Ausstellungen
        female: femaleExhibitions.size // Zähle die einzigartigen weiblichen Ausstellungen
      });
    }
  } else {
    // Zeige nur das ausgewählte Jahr an
    const genderData = aggregatedData.get(currentFilters.year) || new Map();
    const maleExhibitions = genderData.get("M") ? new Set(genderData.get("M").map(d => d.e_id)) : new Set();
    const femaleExhibitions = genderData.get("F") ? new Set(genderData.get("F").map(d => d.e_id)) : new Set();

    yearData.push({
      year: currentFilters.year,
      male: maleExhibitions.size,   // Zähle die einzigartigen männlichen Ausstellungen
      female: femaleExhibitions.size // Zähle die einzigartigen weiblichen Ausstellungen
    });
  }

  console.log("Year Data:", yearData);

  // Setze Skalen für die Achsen
  const xScale = d3.scaleBand()
    .domain(yearData.map(d => d.year))
    .range([0, width])
    .padding(0.1);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(yearData, d => d.male + d.female)])
    .nice()
    .range([height, 0]);

  // Lösche alle alten Elemente
  svg.selectAll("*").remove();

  // X-Achse hinzufügen
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(xScale));

  // Y-Achse hinzufügen
  svg.append("g")
    .call(d3.axisLeft(yScale));

  // Erstelle die Balken
  svg.selectAll(".year-group")
    .data(yearData)
    .enter()
    .append("g")
    .attr("class", "year-group")
    .attr("transform", d => `translate(${xScale(d.year)}, 0)`)
    .each(function (d) {
      const group = d3.select(this);

      // Männliche Balken (blau), nur wenn Männlich im Filter oder beide
      if (currentFilters.gender === "both" || currentFilters.gender === "M") {
        group.append("rect")
          .attr("x", 0)
          .attr("y", yScale(d.male))
          .attr("width", xScale.bandwidth() / 2)
          .attr("height", height - yScale(d.male))
          .attr("fill", "#1e81b0")
          .on("mouseover", (event) => {
            tooltip.style("visibility", "visible")
              .html(`Year: ${d.year}<br>Unique Male Exhibitions: ${d.male}`);
          })
          .on("mousemove", (event) => {
            tooltip.style("top", (event.pageY + 5) + "px")
              .style("left", (event.pageX + 5) + "px");
          })
          .on("mouseout", () => {
            tooltip.style("visibility", "hidden");
          });
      }

      // Weibliche Balken (rosa), nur wenn Weiblich im Filter oder beide
      if (currentFilters.gender === "both" || currentFilters.gender === "F") {
        group.append("rect")
          .attr("x", xScale.bandwidth() / 2)
          .attr("y", yScale(d.female))
          .attr("width", xScale.bandwidth() / 2)
          .attr("height", height - yScale(d.female))
          .attr("fill", "#f1a7c1")
          .on("mouseover", (event) => {
            tooltip.style("visibility", "visible")
              .html(`Year: ${d.year}<br>Unique Female Exhibitions: ${d.female}`);
          })
          .on("mousemove", (event) => {
            tooltip.style("top", (event.pageY + 5) + "px")
              .style("left", (event.pageX + 5) + "px");
          })
          .on("mouseout", () => {
            tooltip.style("visibility", "hidden");
          });
      }
    });
}
