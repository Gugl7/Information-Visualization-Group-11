let currentMode = "global";
var yGrid = null;
var idleTimeout;
let maxBubbleSize;
let radiusBubbleScale;
var svgBubbleChart;

// TOOLTIP
var venuesTooltip = d3.select("body")
    .append("div")
    .attr("id", "venueTooltip")

// TOOLTIP: auxiliary functions
const formatTableRow = (label, value) => `<tr><td>${label}:</td><td style='text-align: right;'>${value}</td></tr>`;
const uniqueValues = (array, key) => [...new Set(array.map(item => item[key]))];
const groupBy = (array, key) => array.reduce((acc, item) => {
    acc[item[key]] = acc[item[key]] || [];
    acc[item[key]].push(item);
    return acc;
}, {});

// Dynamic dimensions and SVG setup
let chart_margin = {top: 10, right: 40, bottom: 90, left: 66}; // right: 50
let chart_width = document.querySelector(".bubble-chart").clientWidth - chart_margin.left - chart_margin.right;
let chart_height = 550;

function updateChartDimensions() {
    chart_width = document.querySelector(".bubble-chart").clientWidth - chart_margin.left - chart_margin.right;
    d3.select("#bubble_chart").selectAll("*").remove();
    renderChart();
    addLegend();
}

function idled() {
    idleTimeout = null;
}

function findMaxArtistsAndPaintingsVenue() {

    let result = {
        maxArtistsGlobal: 0,
        maxPaintingsGlobal: 0,
    };
    for (const [, cities] of groupedData) {
        for (const [, venues] of cities) {
            for ([venue, records] of venues) {
                let uniqueArtistsCount = new Set(records.map(d => d["a.id"])).size;
                if (uniqueArtistsCount > result.maxArtistsGlobal) {
                    result.maxArtistsGlobal = uniqueArtistsCount;
                }
                const allPaintings = d3.sum(records, d => +d["e.paintings"]);
                if (allPaintings > result.maxPaintingsGlobal) {
                    result.maxPaintingsGlobal = allPaintings;
                }
            }
        }
    }
    return result;
}

function renderChart() {
    const venueData = d3.group(filterData(), d => `${d["e.venue"]}__${d["e.city"]}`);

    const {maxArtistsGlobal, maxPaintingsGlobal} = findMaxArtistsAndPaintingsVenue();
    const aggrData = getAggregatedData(venueData);

    d3.select("#bubble_chart").selectAll("*").remove();

    svgBubbleChart = d3.select("#bubble_chart")
        .append("svg")
        .attr("width", chart_width + chart_margin.right + chart_margin.left)
        .attr("height", chart_height + chart_margin.bottom)
        .append("g")
        .attr("transform", `translate(${chart_margin.left}, ${chart_margin.top})`);

    let isMaxGlobal = (currentMode === "global");

    // scatter: where both the circles and the brush take place
    var scatter = svgBubbleChart.append('g')
        .attr("clip-path", "url(#clip)")

    // ---------------------------//
    //           X AXIS           //
    // ---------------------------//

    // X AXIS: Data preparation
    const x_countries = Array.from(new Set(filteredData.map(d => d["e.country"])));

    var bubbleColor = d3.scaleOrdinal()
        .domain(x_countries)
        .range(d3.schemeCategory20)

    // X AXIS: Scale
    const rangeX = d3.scaleBand()
        .domain(x_countries)
        .range([0, chart_width]);

    renderXAxisLabels(svgBubbleChart, rangeX, x_countries);

    // ---------------------------//
    //         BUBBLE SIZE        //
    // ---------------------------//

    // BUBBLE SIZE: Prepare data and scale
    const topBubblePaintings = d3.max(aggrData, d => d.allPaintings);
    const topBubble = aggrData.find(d => d.allPaintings === topBubblePaintings);
    const totalArtistsTopBubble = topBubble ? topBubble.totalArtists : null;

    maxBubbleSize = isMaxGlobal ? maxArtistsGlobal : d3.max(aggrData, d => d.totalArtists);
    radiusBubbleScale = d3.scaleSqrt()
        .domain([1, maxBubbleSize])
        .range([4, maxBubbleRadius]);

    // ---------------------------//
    //           Y AXIS           //
    // ---------------------------//

    // Y AXIS: Scale and maxPaintings calculation
    const maxPaintingsLocal = d3.max(aggrData, d => d.allPaintings);
    const radiusForVenue = totalArtistsTopBubble ? radiusBubbleScale(totalArtistsTopBubble) : null;

    const maxBubbleRadiusLocal = topBubblePaintings / (chart_width / (radiusForVenue * 1.33));
    const maxBubbleRadiusGlobal = maxPaintingsGlobal / (chart_width / (maxBubbleRadius + 10));

    const maxPaintings = isMaxGlobal
        ? maxPaintingsGlobal + maxBubbleRadiusGlobal * 2
        : maxPaintingsLocal + maxBubbleRadiusLocal * 2;

    // Add Y AXIS
    var rangeY = d3.scaleLinear()
        .domain([0, maxPaintings])
        .range([chart_height, 0]);

    var yAxis = svgBubbleChart.append("g")
        .call(d3.axisLeft(rangeY));

    renderYAxisLabels(svgBubbleChart);

    // ClipPath: everything out of this area won't be drawn.
    svgBubbleChart.append("defs")
        .append("svg:clipPath")
        .attr("id", "clip")
        .append("svg:rect")
        .attr("width", chart_width)
        .attr("height", chart_height)
        .attr("x", 0)
        .attr("y", 0);

    renderGridLines(svgBubbleChart, scatter, rangeX, rangeY);

    addBubblesAndBrush(aggrData, scatter, rangeX, rangeY, yAxis, bubbleColor, maxPaintings);

}

function addBubblesAndBrush(aggrData, scatter, rangeX, rangeY, yAxis, bubbleColor, maxPaintings) {

    // BRUSH
    var brush = d3.brushY()
        .extent([[0, 0], [chart_width, chart_height]])  // brush area: whole graph area
        .on("end", function (event) {
            updateScatterChart(event, scatter, brush, maxPaintings, rangeX, rangeY, yAxis)
        });

    const exhibitionCityVenueMap = d3.group(aggrData, d => `${d.exhibitionIds.join(",")}-${d.vcCountry}`);

    // ---------------------------//
    //           BUBBLES          //
    // ---------------------------//

    // Sort the data based on radius in descending order
    const sortedData = aggrData.sort((a, b) => radiusBubbleScale(b.totalArtists) - radiusBubbleScale(a.totalArtists));

    // VENUE BUBBLES
    scatter
        .selectAll("circle")
        .data(sortedData)
        .enter()
        .append("circle")
        .attr("class", "bubbles")
        .attr("cx", d => rangeX(d.vcCountry) + rangeX.bandwidth() / 2)
        .attr("cy", d => rangeY(d.allPaintings))
        .attr("r", d => radiusBubbleScale(d.totalArtists))
        .style("fill", d => bubbleColor(d.vcCountry))
        .style("opacity", 0.7)
        .on("mousemove", function (event, d) {
            showTooltip(event, d, exhibitionCityVenueMap);
        })
        .on("mouseleave", hideTooltip)
        .on("mouseover", function (event, d) {
            showTooltip(event, d, exhibitionCityVenueMap);
        });

    scatter
        .append("g")
        .attr("class", "brush")
        .call(brush);

    // Make bubbles interactive
    scatter.selectAll("circle")
        .style("pointer-events", "all");
    scatter.select(".brush")
        .lower();
    scatter.select("grid")
        .lower();


}

function getAggregatedData(venueData) {

    return Array.from(venueData, ([key, records]) => {
        const [venue, city] = key.split("__");
        const vcCountry = records[0]["e.country"];
        const exhibitionIds = Array.from(new Set(records.map(d => d["e.id"])));
        const exhibitionCount = exhibitionIds.length;

        const femalePaintings = d3.sum(records, d => (d["a.gender"] === "F" ? +d["e.paintings"] : 0));
        const malePaintings = d3.sum(records, d => (d["a.gender"] === "M" ? +d["e.paintings"] : 0));
        const allPaintings = d3.sum(records, d => +d["e.paintings"]);

        const totalArtists = new Set(records.map(d => d["a.id"])).size;
        const femaleArtists = new Set(records.map(d => d["a.id"], d => d["a.gender"] === "F")).size;
        const maleArtists = new Set(records.map(d => d["a.id"], d => d["a.gender"] === "M")).size;

        const artistIDs = Array.from(new Set(records.map(d => d["a.id"])));
        return {
            vcCountry, city, venue,
            exhibitionCount, exhibitionIds,
            femalePaintings, malePaintings, allPaintings,
            femaleArtists, maleArtists, totalArtists,
            artistIDs
        };
    });
}

function updateScatterChart(event, scatter, brush, maxPaintings, x, y, yAxis) {

    let extent = event.selection;

    if (!extent) {
        if (!idleTimeout) return (idleTimeout = setTimeout(idled, 350));
        y.domain([0, maxPaintings]);
    } else {
        y.domain([y.invert(extent[1]), y.invert(extent[0])]);
        scatter.select(".brush").call(brush.move, null);
    }

    yAxis.transition().duration(1000).call(d3.axisLeft(y));

    yGrid.transition().duration(1000).call(
        d3.axisLeft(y)
            .ticks(10)
            .tickSize(-chart_width)
            .tickFormat("")
    );

    scatter
        .selectAll("circle")
        .transition()
        .duration(1000)
        .attr("cy", d => y(d.allPaintings))
        .attr("cx", d => x(d.vcCountry) + x.bandwidth() / 2);
}

function renderXAxisLabels(svgBubbleChart, x, countries) {

    // X AXIS: Labels
    svgBubbleChart.append("g")
        .attr("transform", `translate(0,${chart_height + 45})`)
        .selectAll("text")
        .data(countries)
        .enter().append("text")
        .attr("x", d => x(d) + x.bandwidth() / 2)
        .style("text-anchor", "middle")
        .text(d => d)

    svgBubbleChart.append("g")
        .call(d3.axisBottom(x))
        .attr("transform", `translate(0,${chart_height})`)
        .selectAll("text").remove();

    // X AXIS: Title
    svgBubbleChart.append("text")
        .attr("x", chart_width / 2)
        .attr("y", chart_height + 75)
        .style("text-anchor", "middle")
        .style("font-size", "14px")
        .text("Countries");

    const bubbleColor = d3.scaleOrdinal(d3.schemeCategory20).domain(countries);

    svgBubbleChart.selectAll("circle")
        .data(countries)
        .enter().append("circle")
        .attr("cx", d => x(d) + x.bandwidth() / 2)
        .attr("cy", chart_height + 24)
        .attr("r", 5)
        .attr("fill", d => bubbleColor(d))
        .attr("opacity", 0.7);
}

function renderYAxisLabels(svgBubbleChart) {

    // Y AXIS: Label
    svgBubbleChart.append("text")
        .attr("x", -(chart_height / 2))
        .attr("y", -55)
        .style("text-anchor", "middle")
        .style("font-size", "14px")
        .attr("transform", "rotate(-90)")
        .text("Paintings");
}

function renderGridLines(svgBubbleChart, scatter, x, y) {

    // X AXIS GRID LINES
    svgBubbleChart.append("g")
        .attr("class", "grid")
        .attr("transform", "translate(0," + chart_height + ")")
        .call(d3.axisBottom(x)
            .ticks(10)
            .tickSize(-chart_height)
            .tickFormat("")
        )
        .lower();

    // Y AXIS GRID LINES
    yGrid = scatter.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y)
            .ticks(20)
            .tickSize(-chart_width)
            .tickFormat("")
        );
}

var showTooltip = function (event, d, exhibitionCityVenueMap) {
    const {venueDetails, tableHtml} = getTooltipTable(d, exhibitionCityVenueMap);
    venuesTooltip
        .transition()
        .duration(100);
    venuesTooltip.style("opacity", 1)
        .html(`${venueDetails}
               ${tableHtml}`)
        .style("left", (event.pageX) + 15 + "px")
        .style("top", (event.pageY + 15) + "px");
};

var hideTooltip = function () {
    venuesTooltip
        .transition()
        .duration(100)
        .style("opacity", 0);
};

function getTooltipTable(d, exhibitionCityVenueMap) {
    const keyExCo = `${d.exhibitionIds.join(",")}-${d.vcCountry}`;

    const matchingVenues = exhibitionCityVenueMap.get(keyExCo) || [];
    const uniqueVenues = uniqueValues(matchingVenues, 'venue');
    const uniqueCities = uniqueValues(matchingVenues, 'city');

    let venueDetails;
    let locationDetails;

    if (matchingVenues.length === 1) {
        venueDetails = `Venue: <strong>${d.venue}</strong>`;
        locationDetails = formatTableRow("Location", `${d.city}, ${d.vcCountry}`);

    } else if (uniqueVenues.length < uniqueCities.length) {
        const venueGroups = groupBy(matchingVenues, 'venue');
        venueDetails = Object.entries(venueGroups)
            .map(([name, entries]) => formatTableRow(`Venues:<br>(${entries.map((_, i) => i + 1).join(", ")})`, `<strong>${name}</strong>`))
            .join("");
        locationDetails = uniqueCities.map((city, i) => formatTableRow(`Location (${i + 1})`, `${city}, ${d.vcCountry}`)).join("");

    } else if (uniqueCities.length === uniqueVenues.length) {
        venueDetails = `Venues:<br>${uniqueVenues.map((venue, i) => `(${i + 1}) <strong>${venue}</strong>`).join("<br>")}`;
        locationDetails = uniqueCities.map((city, i) => formatTableRow(`Location (${i + 1})`, `${city}, ${d.vcCountry}`)).join("");

    } else if (uniqueVenues.length > uniqueCities.length) {
        const venueWithIndex = matchingVenues.map((venue, index) => ({
            index: index + 1,
            name: venue.venue,
            city: venue.city,
        }));

        const venueList = venueWithIndex
            .map(v => `(${v.index}) <strong>${v.name}</strong>`)
            .join("<br>");
        venueDetails = `Venues:<br>${venueList}`;

        const cityGroups = venueWithIndex.reduce((acc, v) => {
            if (!acc[v.city]) acc[v.city] = [];
            acc[v.city].push(v.index);
            return acc;
        }, {});

        locationDetails = Object.entries(cityGroups)
            .map(([city, indices]) => `<tr><td>Location (${indices.join(", ")}):</td><td style='text-align: right;'>${city}, ${d.vcCountry}</td></tr>`)
            .join("");

    } else {
        venueDetails = `Sonderfall<br>Venues:<br>${uniqueVenues.map((v, i) => `(${i + 1}) <strong>${v}</strong>`).join("<br>")}`;
        locationDetails = uniqueCities.map((city, i) => formatTableRow(`Location (${i + 1})`, `${city}, ${d.vcCountry}`)).join("");
    }

    let tableHtml = `<table>${locationDetails}
                <tr><td>Artists:</td><td style='text-align: right;'>${d.totalArtists}</td></tr>
                <tr><td>Exhibitions:</td><td style='text-align: right;'>${d.exhibitionCount}</td></tr>
                <tr><td>Exhibition IDs:</td><td style='text-align: right;'>${d.exhibitionIds.join(", ")}</td></tr>
                <tr><td>Paintings:</td><td style='text-align: right;'>${d.allPaintings}</td></tr>
                </table>`;
    return {venueDetails, tableHtml};
}

function addLegend() {

    d3.select("#venue_legendID").remove();

    let chartWidth = svgBubbleChart.node().getBoundingClientRect().width;

    // Define legend dimensions
    const legendWidth = 180;
    const legendX = chartWidth - legendWidth - 18 - chart_margin.left;
    const legendY = 15;

    let minBubbleSize = 1;
    let min = minBubbleSize;
    let max = maxBubbleSize;
    let half = Math.round((maxBubbleSize - minBubbleSize) / 2);
    let fifth = Math.round((maxBubbleSize - minBubbleSize) / 5);

    const legendVenue = svgBubbleChart.append("g")
        .attr("id", "venue_legendID")
        .attr("transform", `translate(${legendX}, ${legendY})`);

    // Add a white background to the legend
    legendVenue.append("rect")
        .attr("class", "legend-background")
        .attr("rx", 8)
        .attr("ry", 8);

    // Add title and subtitle
    legendVenue.append("text")
        .attr("x", 30)
        .attr("y", 30)
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .text("Artists per Venue");


    const bubbleSizes = [max, half, fifth, min];

    bubbleSizes.forEach((size, i) => {
        let addPosition = 0;
        if (i !== 0) {
            addPosition = (30 - Math.round(radiusBubbleScale(size))) * (i / i);
        }

        const spaceBetween = 30;
        const circleRadius = Math.round(radiusBubbleScale(size));
        const bubbleX = 60;
        const bubbleY = 60 + spaceBetween + addPosition;
        const labelText = bubbleX + 70;

        // LEGEND: Add Bubbles
        legendVenue.append("circle")
            .attr("class", "bubbles-legend")
            .attr("cx", bubbleX)
            .attr("cy", bubbleY)
            .attr("r", circleRadius)

        // LEGEND: Add Connecting Line
        legendVenue.append("line")
            .attr("x1", bubbleX)
            .attr("y1", bubbleY - circleRadius)
            .attr("x2", labelText - 10)
            .attr("y2", bubbleY - circleRadius)
            .style("stroke-width", 2);

        // LEGEND: Add Labels
        legendVenue.append("text")
            .attr("x", labelText)
            .attr("y", bubbleY - circleRadius)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .attr("font-size", "12px")
            .text(size);
    });

}