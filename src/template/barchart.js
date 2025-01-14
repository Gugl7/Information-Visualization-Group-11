let width = 800;
let height = 200;
let margin = { top: 20, right: 30, bottom: 50, left: 70 };

let svg = d3.select("#chart")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);


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

          if (gender === 'M') {
            maleSet.add(eId);
          }
          if (gender === 'F') {
            femaleSet.add(eId);
          }
        });

        return {
          male: maleSet.size,
          female: femaleSet.size,
        };
      },
      d => new Date(d['e.startdate']).getFullYear()  // Gruppierung nach Jahr
    );

    data = aggregatedData.map(([year, values]) => ({
      year: year,
      male: values.male,
      female: values.female,
    }));

    data.sort((a, b) => a.year - b.year);

    xScale.domain(data.map(d => d.year));
    yScale.domain([0, d3.max(data, d => Math.max(d.male, d.female))]).nice();

    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale));

    svg.append("g")
      .call(d3.axisLeft(yScale));

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

    updateVisualization();
  });

const xScale = d3.scaleBand()
  .range([0, width])
  .padding(0.1);

const yScale = d3.scaleLinear()
  .range([height, 0]);

function updateVisualization() {

  const filteredData = data.map(d => ({
    year: d.year,
    male: currentGenderFilter === "F" ? 0 : d.male,
    female: currentGenderFilter === "M" ? 0 : d.female,
  }));

  const bars = svg.selectAll(".bar-group")
    .data(filteredData, d => d.year);

  bars.exit().remove();

  const barsEnter = bars.enter()
    .append("g")
    .attr("class", "bar-group")
    .attr("transform", d => `translate(${xScale(d.year)}, 0)`);

  barsEnter.append("rect")
    .merge(bars.select(".male-bar"))
    .attr("class", "male-bar")
    .attr("x", 0)
    .attr("y", d => yScale(d.male))
    .attr("width", xScale.bandwidth() / 3)
    .attr("height", d => height - yScale(d.male))
    .attr("fill", "#1e81b0")
    .on("mouseover", (event, d) => {
      barsTooltip.style("visibility", "visible")
        .html(`Year: ${d.year}<br>Exhibitions with Male Participants: ${d.male}`);
    })
    .on("mousemove", event => {
      barsTooltip.style("top", (event.pageY + 5) + "px")
        .style("left", (event.pageX + 5) + "px");
    })
    .on("mouseout", () => barsTooltip.style("visibility", "hidden"));

  barsEnter.append("rect")
    .merge(bars.select(".female-bar"))
    .attr("class", "female-bar")
    .attr("x", xScale.bandwidth() / 3)
    .attr("y", d => yScale(d.female))
    .attr("width", xScale.bandwidth() / 3)
    .attr("height", d => height - yScale(d.female))
    .attr("fill", "#f1a7c1")
    .on("mouseover", (event, d) => {
      barsTooltip.style("visibility", "visible")
        .html(`Year: ${d.year}<br>Exhibitions with Female Participants: ${d.female}`);
    })
    .on("mousemove", event => {
      barsTooltip.style("top", (event.pageY + 5) + "px")
        .style("left", (event.pageX + 5) + "px");
    })
    .on("mouseout", () => barsTooltip.style("visibility", "hidden"));

  svg.selectAll(".trendline").remove();

  if (currentGenderFilter !== "both") {
    const trendData = filteredData.map(d => ({
      year: d.year,
      value: currentGenderFilter === "M" ? d.male : d.female
    }));

    const trendLine = d3.line()
      .x(d => xScale(d.year) + xScale.bandwidth() / 2)
      .y(d => yScale(d.value));

    svg.append("path")
      .datum(trendData)
      .attr("class", "trendline")
      .attr("d", trendLine)
      .attr("fill", "none")
      .attr("stroke", currentGenderFilter === "M" ? "#1e81b0" : "#f1a7c1")
      .attr("stroke-width", 2);
  }
}
