let artvisData = [], filteredData = [], groupedData = []; map_groupedData = [];
const maxBubbleRadius = 30;

const map_svg = d3.select("#map").append("svg")
    .attr("width", 1000)
    .attr("height", 500)
    .style("background-color", "#fcfcfc");

const map_group = map_svg.append("g");

const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("visibility", "hidden")
    .style("background-color", "#fff")
    .style("border", "1px solid #ccc")
    .style("padding", "5px")
    .style("border-radius", "3px");


var venuesTooltip = d3.select("body")
    .append("div")
    .attr("id", "venueTooltip")

var barTooltip = d3.select("body")
    .append("div")
    .attr("id", "barTooltip")
    .style("position", "absolute")
    .style("visibility", "hidden")
    .style("background-color", "#fff")
    .style("border", "1px solid #ccc")
    .style("padding", "5px")
    .style("border-radius", "3px");


const mapTooltip = d3.select("body")
    .append("div")
    .attr("id", "mapTooltip")
    .style("position", "absolute")
    .style("visibility", "hidden")
    .style("background-color", "#fff")
    .style("border", "1px solid #ccc")
    .style("padding", "5px")
    .style("border-radius", "3px");

// DOM Elements for controls
const yearSlider = document.getElementById("year-slider");
const genderFilter = document.getElementById("gender-filter");
const filterDetails = document.getElementById("filter-info");

// SWITCH BUTTON
const switchLocal = document.getElementById("switch-local");
const switchGlobal = document.getElementById("switch-global");

window.addEventListener("resize", () => {
    updateChartDimensions();
    updateMapDimensions();
});

switchLocal.addEventListener("click", () => {
    toggleSwitch(switchLocal, switchGlobal);
    updateBubbleChartAndMap();
});
switchGlobal.addEventListener("click", () => {
    toggleSwitch(switchGlobal, switchLocal);
    updateBubbleChartAndMap();
});

yearSlider.addEventListener("input", function () {
    updateFilterInfo();
    updateBubbleChartAndMap();
});
genderFilter.addEventListener("change", function () {
    updateFilterInfo();
    updateBubbleChartAndMap();
});

updateSliderLabel(document.getElementById("year-slider").value);

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

function toggleSwitch(activeButton, inactiveButton) {
    activeButton.classList.add("active");
    inactiveButton.classList.remove("active");
}

function updateSliderLabel() {
    const ticks = document.querySelectorAll(".slider-ticks .tick-year");
    const selectedYear = yearSlider.value;

    ticks.forEach((tick) => {
        if (tick.textContent === selectedYear) {
            tick.classList.add("selected");
        } else {
            tick.classList.remove("selected");
        }
    });
}

function updateFilterInfo() {
    const year = yearSlider.value;
    const gender = genderFilter.value;

    let genderText = "Male & Female Artists";
    if (gender === "M") {
        genderText = "Male Artists";
    } else if (gender === "F") {
        genderText = "Female Artists";
    }
    filterDetails.textContent = `${genderText}, ${year}`;
}

const validStartDates = ["1905", "1906", "1907", "1908", "1909", "1910"];

function filterDataWithoutInvalidValues() {
    const validStartDates_filter = artvisData.filter(d => validStartDates.includes(d["e.startdate"]));
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

function updateBubbleChartAndMap() {
    renderChart();
    addLegend()
    updateMap();
    addMapLegend()
}

// Load data and render chart
d3.dsv(";", "../../data/artvis_dump_NEW-semicolon.csv").then(data => {
    artvisData = data;
    filteredData = filterDataWithoutInvalidValues();
    groupedData = d3.group(filteredData, d => d["e.startdate"], d => d["e.city"], d => d["e.venue"]);
    map_groupedData = d3.group(filteredData, d => d["e.startdate"], d => d["e.city"]);

    d3.json("https://d3js.org/world-110m.v1.json").then(worldData => {
        const mapCountries = topojson.feature(worldData, worldData.objects.countries);

        // World Map
        map_group.selectAll("path")
            .data(mapCountries.features)
            .enter().append("path")
            .attr("d", path)
            .attr("fill", "#f1ecec")
            .attr("stroke", "#d0d0d0");

        updateFilterInfo();
        updateBubbleChartAndMap();
    });
}).catch(error => {
    console.error("Error loading CSV:", error);
});

