let currentMode = "global";
var yGrid = null;
var data = [];
let filteredData = [];
let groupedData = [];
var idleTimeout;

// - 1 - Create a tooltip div that is hidden by default (opacity:0):
var tooltip = d3.select("html")
    .append("div")
    .attr("id", "tooltip")
    .attr("class", "tooltip");

// Tooltip: auxiliary functions
const formatTableRow = (label, value) => `<tr><td>${label}:</td><td style='text-align: right;'>${value}</td></tr>`;
const uniqueValues = (array, key) => [...new Set(array.map(item => item[key]))];
const groupBy = (array, key) => array.reduce((acc, item) => {
    acc[item[key]] = acc[item[key]] || [];
    acc[item[key]].push(item);
    return acc;
}, {});

const validStartDates = ["1905", "1906", "1907", "1908", "1909", "1910"];

// Dynamic dimensions and SVG setup
let margin = {top: 20, right: 60, bottom: 80, left: 70}; // right: 50
let width = document.querySelector(".bubble-chart").clientWidth - margin.left - margin.right;
let height = 550;

function updateDimensions() {
    width = document.querySelector(".bubble-chart").clientWidth - margin.left - margin.right;
    d3.select("#bubble_chart").selectAll("*").remove(); // Clear the existing chart
    renderChart(); // Re-render the chart with updated dimensions
}

// DOM Elements for controls
const yearValue = document.getElementById("year-value");
const yearSlider = document.getElementById("year-slider");
const genderFilter = document.getElementById("gender-filter");
const filterDetails = document.getElementById("filter-info");
// SWITCH BUTTON
const switchLocal = document.getElementById("switch-local");
const switchGlobal = document.getElementById("switch-global");

// EVENT Listeners
window.addEventListener("resize", updateDimensions);

yearSlider.addEventListener("input", updateFilterInfo);
genderFilter.addEventListener("change", updateFilterInfo);

switchLocal.addEventListener("click", () => {
    toggleSwitch(switchLocal, switchGlobal);
    renderChart();
});

switchGlobal.addEventListener("click", () => {
    toggleSwitch(switchGlobal, switchLocal);
    renderChart();
});

yearSlider.addEventListener("input", function () {
    renderChart();
});
genderFilter.addEventListener("change", function () {
    renderChart();
});

// Load data and render chart
d3.dsv(";", "../../data/artvis_dump_NEW-semicolon.csv").then(loadedData => {
    data = loadedData;
    filteredData = filterDataWithoutInvalidValues();
    groupedData = d3.group(filteredData, d => d["e.startdate"], d => d["e.city"], d => d["e.venue"]);
    updateBubbleChart();
}).catch(error => {
    console.error("Error loading CSV:", error);
});

function idled() {
    idleTimeout = null;
}

// Initialise active year
updateSliderLabel(document.getElementById("year-slider").value);

function updateSliderLabel() {
    const ticks = document.querySelectorAll(".slider-ticks .tick-year");
    const selectedYear = yearSlider.value;
    yearValue.textContent = selectedYear;

    ticks.forEach((tick) => {
        if (tick.textContent === selectedYear) {
            tick.classList.add("selected");
        } else {
            tick.classList.remove("selected");
        }
    });
}

function switchMode(mode) {
    const highlight = document.querySelector(".switch-highlight");
    const buttons = document.querySelectorAll(".switch-button");

    if (mode === "global") {
        currentMode = "global";
        highlight.style.left = "0";
        buttons[0].classList.add("active");
        buttons[1].classList.remove("active");
    } else if (mode === "local") {
        currentMode = "local";
        highlight.style.left = "50%";
        buttons[1].classList.add("active");
        buttons[0].classList.remove("active");
    }
}

function updateFilterInfo() {
    const year = yearSlider.value;
    const gender = genderFilter.value;

    let genderText = "All Artists";
    if (gender === "M") {
        genderText = "Male Artists";
    } else if (gender === "F") {
        genderText = "Female Artists";
    }
    filterDetails.textContent = `${genderText}, ${year}`;
}

function toggleSwitch(activeButton, inactiveButton) {
    activeButton.classList.add("active");
    inactiveButton.classList.remove("active");
}

function findMaxArtistsAndPaintingsVenue() {

    let result = {
        maxArtistsGlobal: 0,
        maxPaintingsGlobal: 0,
        venueWithMostArtists: null,
        venueWithMostPaintings: null
    };

    for (const [startdate, cities] of groupedData) {
        for (const [city, venues] of cities) {
            for (const [venue, records] of venues) {
                // MAX ARTISTS GLOBAL of a single venue
                const uniqueArtistsCount = new Set(records.map(d => d["a.id"])).size;
                if (uniqueArtistsCount > result.maxArtistsGlobal) {
                    result.maxArtistsGlobal = uniqueArtistsCount;
                    result.venueWithMostArtists = {startdate, venue, city};
                }
                // MAX PAINTINGS GLOBAL of a single venue
                const totalPaintings = d3.sum(records, d => +d["e.paintings"]);
                if (totalPaintings > result.maxPaintingsGlobal) {
                    result.maxPaintingsGlobal = totalPaintings;
                    result.venueWithMostPaintings = {startdate, venue, city}; //{startdate, venue, city};
                }
            }
        }
    }
    return result;
}

function filterDataWithoutInvalidValues() {
    const validStartDates_filter = data.filter(d => validStartDates.includes(d["e.startdate"]));
    return validStartDates_filter.filter(record => {
        return Object.values(record).every(value => value !== "\\N" && value !== "0000-01-01" && value !== "-");
    });
}

function filterData() {
    const selectedYear = yearSlider.value;
    const selectedGender = genderFilter.value;

    return filteredData.filter(d => {
        const yearOpt = d["e.startdate"] === selectedYear;
        const genderOpt = d["a.gender"] === selectedGender;

        const validBirthDate = d["a.birthdate"] !== "0000-01-01";
        const validDeathDate = d["a.deathdate"] !== "0000-01-01";
        const validBirthPlace = d["a.birthplace"] !== "\\N";
        const validDeathPlace = d["a.deathplace"] !== "\\N";
        const validNationality = d["a.nationality"] !== "\\N";

        const validData = validBirthDate && validDeathDate && validBirthPlace && validDeathPlace && validNationality;

        if (yearOpt) {
            if (selectedGender === "ALL") {
                return validData;
            }
            return validData && genderOpt;
        }
    });
}

function updateBubbleChart() {
    updateFilterInfo();
    renderChart();
}

function renderChart() {

    width = document.querySelector(".bubble-chart").clientWidth - margin.left - margin.right;

    const venueData = d3.group(filterData(), d => `${d["e.venue"]}__${d["e.city"]}`);

    const {maxArtistsGlobal, maxPaintingsGlobal} = findMaxArtistsAndPaintingsVenue();
    const aggregatedData = getAggregatedData(venueData);

    d3.select("#bubble_chart").selectAll("*").remove(); // Clear existing chart

    var svg = d3.select("#bubble_chart")
        .append("svg")
        .attr("width", width + margin.right + margin.left)
        .attr("height", height + margin.top + margin.bottom)
        //.attr("transform", `translate(${margin.left},${margin.top})`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    let isGenderAll = (currentMode === "global");

    // scatter: where both the circles and the brush take place
    var scatter = svg.append('g')
        .attr("clip-path", "url(#clip)")

    // ---------------------------//
    //           X AXIS           //
    // ---------------------------//

    // X AXIS: Data preparation
    const countries = Array.from(new Set(filteredData.map(d => d["e.country"])));
    const countriesWithData = countries.filter(country => aggregatedData.some(d => d.country === country));
    const countryData = isGenderAll ? countries : countriesWithData;
    const bubbleColor = d3.scaleOrdinal(d3.schemeCategory20).domain(countries);

    // X AXIS: Scale
    const x = d3.scaleBand()
        .domain(countryData)
        .range([0, width]);

    renderXAxisLabels(svg, x, countries, countryData);

    // ---------------------------//
    //         BUBBLE SIZE        //
    // ---------------------------//

    // BUBBLE SIZE: Prepare data and scale
    const topBubblePaintings = d3.max(aggregatedData, d => d.totalPaintings);
    const topBubble = aggregatedData.find(d => d.totalPaintings === topBubblePaintings);
    const totalArtistsTopBubble = topBubble ? topBubble.totalArtists : null;

    const maxBubbleSize = isGenderAll ? maxArtistsGlobal : d3.max(aggregatedData, d => d.totalArtists);
    const radiusBubbleScale = d3.scaleSqrt()
        .domain([1, maxBubbleSize])
        .range([4, 30]);

    // ---------------------------//
    //           Y AXIS           //
    // ---------------------------//

    // Y AXIS: Scale and maxPaintings calculation
    const maxPaintingsLocal = d3.max(aggregatedData, d => d.totalPaintings);
    const radiusForVenue = totalArtistsTopBubble ? radiusBubbleScale(totalArtistsTopBubble) : null;

    const maxBubbleRadiusLocal = topBubblePaintings / (width / (radiusForVenue * 1.33));
    const maxBubbleRadiusGlobal = maxPaintingsGlobal / (width / 40); // 30 = max radius

    const maxPaintings = isGenderAll
        ? maxPaintingsGlobal + maxBubbleRadiusGlobal * 2
        : maxPaintingsLocal + maxBubbleRadiusLocal * 2;

    // Add Y axis
    var y = d3.scaleLinear()
        .domain([0, maxPaintings])
        .range([height, 0]);

    var yAxis = svg.append("g")
        .call(d3.axisLeft(y));

    renderYAxisLabels(svg);

    // Add a clipPath: everything out of this area won't be drawn.
    svg.append("defs")
        .append("svg:clipPath")
        .attr("id", "clip")
        .append("svg:rect")
        .attr("width", width)
        .attr("height", height)
        .attr("x", 0)
        .attr("y", 0);

    renderGridLines(svg, scatter, x, y);

    // Add brushing
    var brush = d3.brushY()
        // initialise the brush area: select the whole graph area
        .extent([[0, 0], [width, height]])
        .on("end", function (event) {
            updateChart(event, scatter, brush, maxPaintings, x, y, yAxis)
        });

    const exhibitionCityVenueMap = d3.group(aggregatedData, d => `${d.exhibitionIds.join(",")}-${d.country}`);

    // ---------------------------//
    //           BUBBLES          //
    // ---------------------------//

    // Sortiere die Daten basierend auf dem Radius in absteigender Reihenfolge
    const sortedData = aggregatedData.sort((a, b) => radiusBubbleScale(b.totalArtists) - radiusBubbleScale(a.totalArtists));

    // VENUE BUBBLES
    scatter
        .selectAll("circle")
        .data(sortedData)
        .enter()
        .append("circle")
        .attr("class", "bubbles")
        .attr("cx", d => x(d.country) + x.bandwidth() / 2)
        .attr("cy", d => y(d.totalPaintings))
        .attr("r", d => radiusBubbleScale(d.totalArtists))
        .style("fill", d => bubbleColor(d.country))
        .style("opacity", 0.7)
        .on("mousemove", function (event) {
            showTooltip(event, exhibitionCityVenueMap);
        })
        .on("mouseleave", hideTooltip)
        .on("mouseover", function (event) {
            showTooltip(event, exhibitionCityVenueMap);
        });

    scatter
        .append("g")
        .attr("class", "brush")
        .call(brush);

    // make the bubbles interactive
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
        const country = records[0]["e.country"];
        const exhibitionIds = Array.from(new Set(records.map(d => d["e.id"])));
        const exhibitionCount = exhibitionIds.length;

        const femalePaintings = d3.sum(records, d => (d["a.gender"] === "F" ? +d["e.paintings"] : 0));
        const malePaintings = d3.sum(records, d => (d["a.gender"] === "M" ? +d["e.paintings"] : 0));
        const totalPaintings = d3.sum(records, d => +d["e.paintings"]);

        const totalArtists = new Set(records.map(d => d["a.id"])).size;
        const femaleArtists = new Set(records.map(d => d["a.id"], d => d["a.gender"] === "F")).size;
        const maleArtists = new Set(records.map(d => d["a.id"], d => d["a.gender"] === "M")).size;

        const artistIDs = Array.from(new Set(records.map(d => d["a.id"])));
        return {
            country, city, venue,
            exhibitionCount, exhibitionIds,
            femalePaintings, malePaintings, totalPaintings,
            femaleArtists, maleArtists, totalArtists,
            artistIDs
        };
    });
}

function updateChart(d, scatter, brush, maxPaintings, x, y, yAxis) {
    let extent = d3.event.selection;

    // If no selection, back to initial coordinate. Otherwise, update X axis domain
    if (!extent) {
        if (!idleTimeout) return idleTimeout = setTimeout(idled, 350);
        y.domain([0, maxPaintings])
    } else {
        y.domain([y.invert(extent[1]), y.invert(extent[0])])
        scatter.select(".brush").call(brush.move, null)
    }

    // Update axis and circle position
    yAxis.transition().duration(1000).call(d3.axisLeft(y))

    // Update Y Grid Lines with proper settings
    yGrid.transition().duration(1000).call(
        d3.axisLeft(y)
            .ticks(10)
            .tickSize(-width)
            .tickFormat("")
    );

    scatter
        .selectAll("circle")
        .transition()
        .duration(1000)
        .attr("cy", d => y(d.totalPaintings))
        .attr("cx", d => x(d.country) + x.bandwidth() / 2)
}

function renderXAxisLabels(svg, x, countries, countryData) {
    // X AXIS: Labels
    svg.append("g")
        .attr("transform", `translate(0,${height + 45})`)
        .selectAll("text")
        .data(countryData)
        .enter().append("text")
        .attr("x", d => x(d) + x.bandwidth() / 2)
        .style("text-anchor", "middle")
        .text(d => d)

    svg.append("g")
        .call(d3.axisBottom(x))
        .attr("transform", `translate(0,${height})`)
        .selectAll("text").remove();

    // X AXIS: Title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 70)
        .style("text-anchor", "middle")
        .text("Countries");

    const bubbleColor = d3.scaleOrdinal(d3.schemeCategory20).domain(countries);

    svg.selectAll("circle")
        .data(countryData)
        .enter().append("circle")
        .attr("cx", d => x(d) + x.bandwidth() / 2)
        .attr("cy", height + 24)
        .attr("r", 5)
        .attr("fill", d => bubbleColor(d))
        .attr("opacity", 0.7);
}

function renderYAxisLabels(svg) {
    // Y AXIS: Label
    svg.append("text")
        .attr("x", -(height / 2))
        .attr("y", -50)
        .style("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .text("Paintings");
}

function renderGridLines(svg, scatter, x, y) {
    // X AXIS GRID LINES
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x)
            .ticks(10)
            .tickSize(-height)
            .tickFormat("")
        )
        .lower();

    // Y AXIS GRID LINES
    yGrid = scatter.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y)
            .ticks(20)
            .tickSize(-width)
            .tickFormat("")
        );
}

var showTooltip = function (d, exhibitionCityVenueMap) {
    const {venueDetails, tableHtml} = getTooltipTable(d, exhibitionCityVenueMap);
    tooltip
        .transition()
        .duration(100);
    tooltip.style("opacity", 1)
        .html(`${venueDetails}
               ${tableHtml}`)
        .style("left", (event.pageX) + 15 + "px")
        .style("top", (event.pageY + 15) + "px");
};

var hideTooltip = function () {
    tooltip
        .transition()
        .duration(100)
        .style("opacity", 0);
};

function getTooltipTable(d, exhibitionCityVenueMap) {
    const key = `${d.exhibitionIds.join(",")}-${d.country}`;
    const matchingVenues = exhibitionCityVenueMap.get(key) || [];
    const uniqueVenues = uniqueValues(matchingVenues, 'venue');
    const uniqueCities = uniqueValues(matchingVenues, 'city');

    let venueDetails;
    let locationDetails;

    if (matchingVenues.length === 1) {
        venueDetails = `Venue: <strong>${d.venue}</strong>`;
        locationDetails = formatTableRow("Location", `${d.city}, ${d.country}`);

    } else if (uniqueVenues.length < uniqueCities.length) {
        const venueGroups = groupBy(matchingVenues, 'venue');
        venueDetails = Object.entries(venueGroups)
            .map(([name, entries]) => formatTableRow(`Venues:<br>(${entries.map((_, i) => i + 1).join(", ")})`, `<strong>${name}</strong>`))
            .join("");
        locationDetails = uniqueCities.map((city, i) => formatTableRow(`Location (${i + 1})`, `${city}, ${d.country}`)).join("");

    } else if (uniqueCities.length === uniqueVenues.length) {
        venueDetails = `Venues:<br>${uniqueVenues.map((venue, i) => `(${i + 1}) <strong>${venue}</strong>`).join("<br>")}`;
        locationDetails = uniqueCities.map((city, i) => formatTableRow(`Location (${i + 1})`, `${city}, ${d.country}`)).join("");

    } else if (uniqueVenues.length > uniqueCities.length) {
        const venueWithIndex = matchingVenues.map((venue, index) => ({
            index: index + 1,
            name: venue.venue,
            city: venue.city,
        }));

        venueList = venueWithIndex
            .map(v => `(${v.index}) <strong>${v.name}</strong>`)
            .join("<br>");
        venueDetails = `Venues:<br>${venueList}`;

        const cityGroups = venueWithIndex.reduce((acc, v) => {
            if (!acc[v.city]) acc[v.city] = [];
            acc[v.city].push(v.index);
            return acc;
        }, {});

        locationDetails = Object.entries(cityGroups)
            .map(([city, indices]) => `<tr><td>Location (${indices.join(", ")}):</td><td style='text-align: right;'>${city}, ${d.country}</td></tr>`)
            .join("");

    } else {
        venueDetails = `Sonderfall<br>Venues:<br>${uniqueVenues.map((v, i) => `(${i + 1}) <strong>${v}</strong>`).join("<br>")}`;
        locationDetails = uniqueCities.map((city, i) => formatTableRow(`Location (${i + 1})`, `${city}, ${d.country}`)).join("");
    }

    let tableHtml = `<table>${locationDetails}
                <tr><td style='text-align: left;'>Artists:</td><td style='text-align: right;'>${d.totalArtists}</td></tr>
                <tr><td style='text-align: left;'>Exhibitions:</td><td style='text-align: right;'>${d.exhibitionCount}</td></tr>
                <tr><td style='text-align: left;'>Exhibition IDs:</td><td style='text-align: right;'>${d.exhibitionIds.join(", ")}</td></tr>
                <tr><td style='text-align: left;'>Paintings:</td><td style='text-align: right;'>${d.totalPaintings}</td></tr>
                </table>`;
    return {venueDetails, tableHtml};
}