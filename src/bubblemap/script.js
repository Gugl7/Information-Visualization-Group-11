let width = window.innerWidth;
let height = window.innerHeight;

let allData = [];
let g;
let zoomLevel = 1;

const yearRange = d3.select("#year-range");
const yearDisplay = d3.select("#year-display");
const yearLower = d3.select("#year-lower");
const yearUpper = d3.select("#year-upper");
const maleFilter = d3.select("#male-filter");
const femaleFilter = d3.select("#female-filter");

yearRange.on("change", () => {
  const lower = yearLower.property("value");
  const upper = yearUpper.property("value");
  yearDisplay.text(`${lower} - ${upper}`);
  updateVisualization();
});

maleFilter.on("change", updateVisualization);
femaleFilter.on("change", updateVisualization);

function filterData() {
  const selectedLowerYear = +yearLower.property("value");
  const selectedUpperYear = +yearUpper.property("value");
  const showMale = maleFilter.property("checked");
  const showFemale = femaleFilter.property("checked");

  return allData.filter(d => {
    const withinYearRange = d['e.startdate'] >= selectedLowerYear && d['e.startdate'] <= selectedUpperYear;
    const male = showMale && d['a.gender'] === "M";
    const female = showFemale && d['a.gender'] === "F";
    return withinYearRange && (male || female);
  });
}

function updateVisualization() {
  const filteredData = filterData();
  const cityData = d3.group(filteredData, d => d["e.city"]);

  aggregatedData = Array.from(cityData, ([city, records]) => {
    const malePaintings = d3.sum(records, d => (d["a.gender"] === "M" ? +d["e.paintings"] : 0));
    const femalePaintings = d3.sum(records, d => (d["a.gender"] === "F" ? +d["e.paintings"] : 0));
    const totalPaintings = malePaintings + femalePaintings;
    const latitude = records[0]["e.latitude"];
    const longitude = records[0]["e.longitude"];
    const country = records[0]["e.country"];
    return {
      city,
      malePaintings,
      femalePaintings,
      totalPaintings,
      latitude: +latitude,
      longitude: +longitude,
      country,
    };
  });

  const radiusScale = d3.scaleSqrt()
      .domain([0, d3.max(aggregatedData, d => d.totalPaintings)]) // Input range
      .range([2, 30]); // Output range (min and max radius)

  // ==========================================================
  // Add a legend group
  d3.select("#legend").remove(); // Remove existing legend
  const legend = svg.append("g")
    .attr("id", "legend");

  // Define legend data for circle sizes
  const legendData = [100, 500, 1000, 10000]; // Number of paintings for reference

  // Add legend circles and labels
  legendData.forEach((d, i) => {
    const yOffset = i * 50; // Vertical spacing between legend items
    // Circle
    legend.append("circle")
      .attr("cx", 20) // X-coordinate of the circle (relative to legend group)
      .attr("cy", yOffset) // Y-coordinate of the circle (relative to legend group)
      .attr("r", radiusScale(d)) // Radius based on data
      .attr("fill", "black")
      .attr("opacity", 0.7);

    // Label
    legend.append("text")
      .attr("x", 50) // X-coordinate for text (relative to legend group)
      .attr("y", yOffset + 5) // Y-coordinate for text (slightly adjusted)
      .attr("font-size", "12px")
      .attr("font-family", "Arial, sans-serif")
      .attr("fill", "black")
      .text(`${d} paintings`);
  });

  // Legend title
  legend.append("text")
    .attr("x", 20)
    .attr("y", -10) // Above the circles
    .attr("font-size", "14px")
    .attr("font-family", "Arial, sans-serif")
    .attr("fill", "black")
    .text("Bubble Size Legend");

  // Position the legend in the bottom-right corner
  function updateLegendPosition() {
    const svgWidth = svg.node().getBoundingClientRect().width;
    const svgHeight = svg.node().getBoundingClientRect().height;

    legend.attr("transform", `translate(${svgWidth - 200}, ${svgHeight - 200})`);
  }

  // Call initially and on window resize
  updateLegendPosition();
  window.addEventListener("resize", updateLegendPosition);
  // ==========================================================


  // Clear existing circles
  g.selectAll("circle").remove();

  g.selectAll("g.bubble")
    .data(aggregatedData)
    .join("g")
    .attr("class", "bubble")
    .each(function(d) {
      const group = d3.select(this);

      const coords = projection([d.longitude, d.latitude]);
      if (!coords) return;

      const totalPaintings = d.totalPaintings || 1;
      const femaleRatio = d.femalePaintings / totalPaintings;

      const cx = coords[0];
      const cy = coords[1];
      const totalRadius = radiusScale(totalPaintings);

      const scale = 1;

      group.append("circle")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", totalRadius * scale / zoomLevel) // Scaled by male ratio
        .attr("fill", "#1e81b0");

      group.append("circle")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", totalRadius * femaleRatio * scale / zoomLevel)
        .attr("fill", "#f1a7c1")
        .attr("stroke-width", 1);

      group.on("mouseover", (event, d) => {
        tooltip.style("visibility", "visible")
          .html(`
            <br>
            <strong>${d.city}</strong><br>
            Total Paintings: ${d.totalPaintings}<br>
            Male Paintings: ${d.malePaintings}<br>
            Female Paintings: ${d.femalePaintings}
          `);
      })
      .on("mousemove", event => {
        tooltip.style("top", (event.pageY + 5) + "px")
          .style("left", (event.pageX + 5) + "px");
      })
      .on("mouseout", () => {
        tooltip.style("visibility", "hidden");
      });
    });
}

// ==========================================================
// Slider from stackoverflow; copied just the HTML element
// https://stackoverflow.com/questions/4753946/html-slider-with-two-inputs-possible
function getVals(){
  // Get slider values
  var parent = this.parentNode;
  var slides = parent.getElementsByTagName("input");
    var slide1 = parseFloat( slides[0].value );
    var slide2 = parseFloat( slides[1].value );
  // Neither slider will clip the other, so make sure we determine which is larger
  if( slide1 > slide2 ){ var tmp = slide2; slide2 = slide1; slide1 = tmp; }
  
  var displayElement = parent.getElementsByClassName("rangeValues")[0];
      displayElement.innerHTML = slide1 + " - " + slide2;
}

window.onload = function(){
  // Initialize Sliders
  var sliderSections = document.getElementsByClassName("range-slider");
      for( var x = 0; x < sliderSections.length; x++ ){
        var sliders = sliderSections[x].getElementsByTagName("input");
        for( var y = 0; y < sliders.length; y++ ){
          if( sliders[y].type ==="range" ){
            sliders[y].oninput = getVals;
            // Manually trigger event first time to display values
            sliders[y].oninput();
          }
        }
      }
  updateVisualization();
}
// ==========================================================

const svg = d3.select("#map").append("svg")
  .attr("width", width)
  .attr("height", height);

g = svg.append("g");

const projection = d3.geoMercator()
  .scale((width + height) / 2 / Math.PI)
  .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

window.addEventListener("resize", () => {
  // Update dimensions
  width = window.innerWidth;
  height = window.innerHeight;

  // Update SVG dimensions
  svg.attr("width", width).attr("height", height);

  // Update projection
  projection
    .scale((width + height) / 2 / Math.PI)
    .translate([width / 2, height / 2]);

  // Update map paths
  g.selectAll("path")
    .attr("d", path);

  // Update bubble positions
  g.selectAll("circle")
    .attr("cx", d => {
      const coords = projection([d.longitude, d.latitude]);
      return coords ? coords[0] : null;
    })
    .attr("cy", d => {
      const coords = projection([d.longitude, d.latitude]);
      return coords ? coords[1] : null;
    });
});

const tooltip = d3.select("#tooltip");

const zoom = d3.zoom()
  .scaleExtent([1, 5])
  .on("zoom", (event) => {
    zoomLevel = event.transform.k;
    updateVisualization();
    const { transform } = event;
    // Update map position and scale
    g.attr("transform", transform);
  });

svg.call(zoom);

// Load and draw the world map
d3.json("https://d3js.org/world-110m.v1.json").then(worldData => {
  const countries = topojson.feature(worldData, worldData.objects.countries);

  g.selectAll("path")
    .data(countries.features)
    .enter().append("path")
    .attr("d", path)
    .attr("fill", "#ddd")
    .attr("stroke", "#999");

  // Load Artvis data from CSV
  d3.dsv(";", "../../data/artvis-filtered.csv").then(data => {
    allData = data;
    updateVisualization();
  });
});