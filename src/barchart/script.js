const width = 800;
const height = 300;
const margin = { top: 20, right: 30, bottom: 50, left: 70 };

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

// Beispiel-Daten
const data = [
  { year: 1905, male: 10, female: 5 },
  { year: 1906, male: 15, female: 10 },
  { year: 1907, male: 5, female: 20 },
  { year: 1908, male: 8, female: 12 },
  { year: 1909, male: 20, female: 15 },
  { year: 1910, male: 25, female: 10 },
];

// Filteroption
let currentGenderFilter = "both";

// Dropdown-Eventlistener
d3.select("#gender-select").on("change", function () {
  currentGenderFilter = this.value; // Aktualisiere Filter basierend auf Dropdown-Wert
  updateVisualization();
});

// Skalen
const xScale = d3.scaleBand()
  .domain(data.map(d => d.year))
  .range([0, width])
  .padding(0.1);

const yScale = d3.scaleLinear()
  .domain([0, d3.max(data, d => d.male + d.female)])
  .nice()
  .range([height, 0]);

// Achsen
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

// Visualisierung aktualisieren
function updateVisualization() {
  const filteredData = data.map(d => ({
    year: d.year,
    male: currentGenderFilter === "F" ? 0 : d.male,
    female: currentGenderFilter === "M" ? 0 : d.female,
  }));

  // Lösche alte Balken
  svg.selectAll(".bar-group").remove();

  // Daten binden und Gruppen für jedes Jahr erstellen
  const bars = svg.selectAll(".bar-group")
    .data(filteredData)
    .enter()
    .append("g")
    .attr("class", "bar-group")
    .attr("transform", d => `translate(${xScale(d.year)}, 0)`);

  // Männliche Balken
  bars.append("rect")
    .attr("x", 0)
    .attr("y", d => yScale(d.male))
    .attr("width", xScale.bandwidth() / 2)
    .attr("height", d => height - yScale(d.male))
    .attr("fill", "#1e81b0")
    .on("mouseover", (event, d) => {
      tooltip.style("visibility", "visible")
        .html(`Year: ${d.year}<br>Male: ${d.male}`);
    })
    .on("mousemove", event => {
      tooltip.style("top", (event.pageY + 5) + "px")
        .style("left", (event.pageX + 5) + "px");
    })
    .on("mouseout", () => tooltip.style("visibility", "hidden"));

  // Weibliche Balken
  bars.append("rect")
    .attr("x", xScale.bandwidth() / 2)
    .attr("y", d => yScale(d.female))
    .attr("width", xScale.bandwidth() / 2)
    .attr("height", d => height - yScale(d.female))
    .attr("fill", "#f1a7c1")
    .on("mouseover", (event, d) => {
      tooltip.style("visibility", "visible")
        .html(`Year: ${d.year}<br>Female: ${d.female}`);
    })
    .on("mousemove", event => {
      tooltip.style("top", (event.pageY + 5) + "px")
        .style("left", (event.pageX + 5) + "px");
    })
    .on("mouseout", () => tooltip.style("visibility", "hidden"));
}

// Initiale Visualisierung
updateVisualization();
