// Bar Chart Configurations
const barChart_margin = { top: 20, right: 30, bottom: 50, left: 70 };
const barChart_width = document.querySelector(".bar-chart-container").clientWidth - barChart_margin.left - barChart_margin.right;
const barChart_height = 200;

// SVG Initialization
const svg = d3.select("#bar-chart")
  .append("svg")
  .attr("width", barChart_width + barChart_margin.left + barChart_margin.right)
  .attr("height", barChart_height + barChart_margin.top + barChart_margin.bottom)
  .append("g")
  .attr("transform", `translate(${barChart_margin.left},${barChart_margin.top})`);


// filter options
let currentGenderFilter = "both";  // "both", "M" oder "F"

// Dropdown-Eventlistener
d3.select("#gender-select").on("change", function () {
  currentGenderFilter = this.value; // Update filter based on dropdown value
  updateBarChart();
});

// Data and Scales
let data = [];
const xScale = d3.scaleBand().range([0, barChart_width]).padding(0.1);
const yScale = d3.scaleLinear().range([barChart_height, 0]);

// Load CSV and aggregate data
d3.dsv(",", "../../data/processed_data.csv")
  .then(loadedData => {
    // Aggregated count for men and women per year
    const aggregatedData = d3.rollups(
      loadedData,  // Do not remove duplicates, all exhibitions are taken into account
      exhibitions => {
        const maleSet = new Set();
        const femaleSet = new Set();

        // Iterate through all exhibitions and check the artists involved
        exhibitions.forEach(d => {
          const eId = d['e.id'];  // Unique exhibition ID
          const gender = d['a.gender'];  // gender of the artist

          if (gender === 'M') maleSet.add(eId);
          if (gender === 'F') femaleSet.add(eId);
        });

        return {
          male: maleSet.size,
          female: femaleSet.size,
        };
      },
      d => new Date(d['e.startdate']).getFullYear()  // grouping by year
    );

    data = aggregatedData.map(([year, values]) => ({
      year: year,
      male: values.male,
      female: values.female,
    }));

    data.sort((a, b) => a.year - b.year);

    xScale.domain(data.map(d => d.year));
    yScale.domain([0, d3.max(data, d => Math.max(d.male, d.female))]).nice();

    drawAxes();
    addHorizontalGridlines();
    updateBarChart();
});

// Draw Axes
function drawAxes() {
    svg.append("g")
      .attr("transform", `translate(0,${barChart_height})`)
      .call(d3.axisBottom(xScale));

    svg.append("g")
      .call(d3.axisLeft(yScale));

    svg.append("text")
      .attr("x", barChart_width / 2)
      .attr("y", barChart_height + barChart_margin.bottom - 10)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .text("Year");

    svg.append("text")
      .attr("x", -barChart_height / 2)
      .attr("y", -barChart_margin.left + 20)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .text("Number of Exhibitions");
}

// Add Horizontal Gridlines
function addHorizontalGridlines() {
    svg.append("g")
        .attr("class", "grid")
        .selectAll("line")
        .data(yScale.ticks())
        .enter()
        .append("line")
        .attr("x1", 0)
        .attr("x2", barChart_width)
        .attr("y1", d => yScale(d))
        .attr("y2", d => yScale(d))
        .attr("stroke", "#ccc")
        .attr("stroke-dasharray", "4")
        .attr("stroke-width", 0.8);
}

/**
 * Update the bar chart based on the current filter settings
 */
function updateBarChart() {

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
    .attr("height", d => barChart_height - yScale(d.male))
    .attr("fill", "#1e81b0")
    .on("mouseover", handleMouseOver("Male Artists"))
    .on("mousemove", handleMouseMove)
    .on("mouseout", handleMouseOut);

  barsEnter.append("rect")
    .merge(bars.select(".female-bar"))
    .attr("class", "female-bar")
    .attr("x", xScale.bandwidth() / 3)
    .attr("y", d => yScale(d.female))
    .attr("width", xScale.bandwidth() / 3)
    .attr("height", d => barChart_height - yScale(d.female))
    .attr("fill", "#f1a7c1")
    .on("mouseover", handleMouseOver("Female Artists"))
    .on("mousemove", handleMouseMove)
    .on("mouseout", handleMouseOut);

    addTrendline(filteredData);
}

// Add Trendline
function addTrendline(filteredData) {
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

// Tooltip Handlers
function handleMouseOver(label) {
    return (event, d) => {
        barTooltip.style("visibility", "visible")
            .html(`<strong>${label}</strong>
        <table style="margin: 5px 0">
          <tr><td>Year:</td><td style='text-align: right;'>${d.year}</td></tr>
          <tr><td>Exhibitions:</td><td style='text-align: right;'>${currentGenderFilter === "M" ? d.male : d.female}</td></tr>
        </table>`);
    };
}

function handleMouseMove(event) {
    barTooltip.style("top", (event.pageY + 5) + "px")
        .style("left", (event.pageX + 5) + "px");
}

function handleMouseOut() {
    barTooltip.style("visibility", "hidden");
}
