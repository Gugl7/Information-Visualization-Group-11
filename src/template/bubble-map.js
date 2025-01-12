let map_width = window.innerWidth;
let map_height = window.innerHeight;


let map_filteredData = [];
let map_aggregatedData = [];

let map_zoomLevel = 1;
let map_groupedData = [];

let map_bubbleColor;

let map_maxTotalPaintingsGlobal = 0;
let map_minPaintingsGlobal = Infinity;

let map_maxPaintings;
let map_minPaintings;

let map_radiusScale;
const map_maxRadius = 34;


const projection = d3.geoMercator()
    .scale((map_width + map_height) / 2 / Math.PI)
    .translate([map_width / 2, map_height / 2]);

const path = d3.geoPath().projection(projection);

const mapTooltip = d3.select("body")
    .append("div")
    .attr("id", "mapTooltip")

const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", (event) => {
        map_zoomLevel = event.transform.k;
        updateMap();
        const {transform} = event;
        map_group.attr("transform", transform);
    });

map_svg.call(zoom);

function findMinAndMaxPaintings() {

    for (const [startdate, cities] of map_groupedData) {
        for (const [city, records] of cities) {
            const totalPaintings = d3.sum(records, d => +d["e.paintings"]);

            if (totalPaintings > map_maxTotalPaintingsGlobal) {
                map_maxTotalPaintingsGlobal = totalPaintings;
            }

            if (totalPaintings > 0 && totalPaintings < map_minPaintingsGlobal) {
                map_minPaintingsGlobal = totalPaintings;
            }
        }
    }

    if (map_minPaintingsGlobal === Infinity) {
        map_minPaintingsGlobal = 0;
    }

    return {
        max: map_maxTotalPaintingsGlobal,
        min: map_minPaintingsGlobal
    };
}

function updateMap() {
    const map_cityData = d3.group(filterData(), d => d["e.city"]);

    let {max: maxTotalPaintingsGlobalMap, min: minMapPaintingsGlobal} = findMinAndMaxPaintings();

    map_aggregatedData = Array.from(map_cityData, ([city, records]) => {
        const malePaintings = d3.sum(records, d => (d["a.gender"] === "M" ? +d["e.paintings"] : 0));
        const femalePaintings = d3.sum(records, d => (d["a.gender"] === "F" ? +d["e.paintings"] : 0));
        const totalPaintings = malePaintings + femalePaintings;
        const latitude = records[0]["e.latitude"];
        const longitude = records[0]["e.longitude"];
        const country = records[0]["e.country"];
        const venuesCount = Array.from(new Set(records.map(d => d["e.venue"]))).length;
        return {
            city,
            malePaintings,
            femalePaintings,
            totalPaintings,
            latitude: +latitude,
            longitude: +longitude,
            country,
            venuesCount
        };
    });

    isMaxGlobalMap = (currentMode === "global");

    const mapCountries = Array.from(new Set(map_filteredData.map(d => d["e.country"])));

    const maxMapPaintingsLocal = d3.max(map_aggregatedData, d => d.totalPaintings)
    const minMapPaintingsLocal = d3.min(map_aggregatedData, d => d.totalPaintings);

    map_maxPaintings = isMaxGlobalMap ? maxTotalPaintingsGlobalMap : maxMapPaintingsLocal;
    map_minPaintings = isMaxGlobalMap ? minMapPaintingsGlobal : minMapPaintingsLocal;

    map_radiusScale = d3.scaleSqrt()
        .domain([map_minPaintings, map_maxPaintings])
        .range([4, map_maxRadius]);

    if (genderFilter.value === "ALL") {
        map_bubbleColor = d => d["a.gender"] === "M" ? "#418fc7" : "#ea8dc3";
    } else {
        map_bubbleColor = d3.scaleOrdinal()
            .domain(mapCountries)
            .range(d3.schemeCategory20);
    }

    addPiesBubblesTooltip()
}

function addPiesBubblesTooltip() {

    const sortedMapData = map_aggregatedData.sort((a, b) =>
        map_radiusScale(b.totalPaintings) - map_radiusScale(a.totalPaintings)
    );

    map_group.selectAll("circle").remove();
    map_group.selectAll("g.bubble")
        .data(sortedMapData)
        .join("g")
        .attr("class", "bubble")
        .each(function (d) {
            const group = d3.select(this);
            const coords = projection([d.longitude, d.latitude]);
            if (!coords) return;

            const [cx, cy] = coords;
            const locationContent = `<strong>${d.city}</strong>, ${d.country}`;
            const venuesContent = `<tr><td>Total Venues:</td><td style='text-align: right;'>${d.venuesCount}</td></tr>`;
            group.selectAll("*").remove();

            if (genderFilter.value === "ALL") {
                const pieData = [
                    {gender: "Male", value: d.malePaintings || 0},
                    {gender: "Female", value: d.femalePaintings || 0},
                ].filter(item => item.value > 0);

                createPieChart(group, cx, cy, pieData, map_radiusScale(d.totalPaintings) / map_zoomLevel);

                createMapTooltip(group, `
                <table>
                    ${locationContent}
                    <hr style="border: 0; margin:5px 0; padding: 0">
                    <tr><td>Total Paintings:</td><td style='text-align: right;'><strong>${d.totalPaintings}</strong></td></tr>
                    <tr><td>Female:</td><td style='text-align: right;'>${d.femalePaintings}</td></tr>
                    <tr><td>Male:</td><td style='text-align: right;'>${d.malePaintings}</td></tr>
                    ${venuesContent}
                </table>
            `);
            } else {
                const isMale = genderFilter.value === "M";
                const paintingCount = isMale ? d.malePaintings || 1 : d.femalePaintings || 1;
                const radius = map_radiusScale(paintingCount) / map_zoomLevel;
                const className = isMale ? "bubbles-m" : "bubbles-f";

                createMapBubbles(group, cx, cy, radius, d.country, className);

                createMapTooltip(group, `
                <table>
                    ${locationContent}
                    <hr style="border: 0; margin:5px 0; padding: 0">
                    <tr><td>Paintings:</td><td><strong>${paintingCount}</strong></td></tr>
                    ${venuesContent}
                </table>
            `);
            }
        });
}

function addMapLegend() {

    d3.select("#legendMapID").remove();

    let mapWidth = map_svg.node().getBoundingClientRect().width;
    let mapHeight = map_svg.node().getBoundingClientRect().height;

    // LEGEND: Dimensions
    const mapLegendWidth = 180, mapLegendHeight = 220;
    const mapLegendX = mapWidth - mapLegendWidth - 15;
    const mapLegendY = mapHeight - mapLegendHeight - 15;

    let max = map_maxPaintings;
    let min = map_minPaintings;
    let half = Math.round((max - min) / 2);
    let fifth = Math.round((max - min) / 5);

    const legendMap = map_svg.append("g")
        .attr("id", "legendMapID")
        .attr("transform", `translate(${mapLegendX}, ${mapLegendY})`);

    // LEGEND: Background
    legendMap.append("rect")
        .attr("class", "legend-background-map")
        .attr("rx", 8)
        .attr("ry", 8);

    // LEGEND: Title Bubble Size
    legendMap.append("text")
        .attr("x", 30)
        .attr("y", 30)
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .text("Paintings per City");

    // LEGEND: Title Pie Chart Colors
    if (genderFilter.value === "ALL") {
        legendMap.append("text")
            .attr("x", 30)
            .attr("y", 165)
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .text("Pie Chart Colors");
    }

    const bubbleSizesMap = [max, half, fifth, min];

    bubbleSizesMap.forEach((size, i) => {
        let addPosition = 0;
        if (i !== 0) {
            addPosition = (34 - Math.round(map_radiusScale(size))) * (i / i);
        }
        const spaceBetween = 60;

        const circleRadius = Math.round(map_radiusScale(size));
        const circleX = spaceBetween;
        const circleY = 34 + spaceBetween + addPosition;
        const textX = 130;

        // LEGEND: Bubbles
        legendMap.append("circle")
            .attr("class", "bubbles-legend")
            .attr("cx", circleX)
            .attr("cy", circleY)
            .attr("r", circleRadius);

        // LEGEND: Connecting Line
        legendMap.append("line")
            .attr("x1", circleX)
            .attr("y1", circleY - circleRadius)
            .attr("x2", textX - 10)
            .attr("y2", circleY - circleRadius)
            .style("stroke-width", 2);

        // LEGEND: Labels
        legendMap.append("text")
            .attr("x", textX)
            .attr("y", circleY - circleRadius)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .attr("font-size", "12px")
            .text(size);
    });

    if (genderFilter.value === "ALL") {

        // LEGEND: Pie Chart Colors
        const pieColors = [
            {color: "#418fc7", label: "Male"},
            {color: "#ea8db1", label: "Female"}
        ];

        // LEGEND: Color Rectangles
        pieColors.forEach((d, i) => {
            legendMap.append("rect")
                .attr("x", 30 + i * 70)
                .attr("y", 185)
                .attr("width", 15)
                .attr("height", 15)
                .attr("fill", d.color);

            // LEGEND: Color Labels
            legendMap.append("text")
                .attr("x", 50 + i * 70)
                .attr("y", 185 + 12)
                .attr("font-size", "12px")
                .text(d.label);
        });
    }
}

const createMapTooltip = (group, content) => {
    group.on("mouseover", (event) => {
        mapTooltip.style("visibility", "visible").html(content);
    })
        .on("mousemove", (event) => {
            mapTooltip.style("top", `${event.pageY + 15}px`)
                .style("left", `${event.pageX + 15}px`);
        })
        .on("mouseout", () => {
            mapTooltip.style("visibility", "hidden");
        });
};

const createPieChart = (group, cx, cy, pieData, radius) => {
    const pie = d3.pie()
        .value(d => d.value)
        .sortValues(d3.ascending);

    const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(radius);

    group.append("g")
        .attr("class", "pie-chart")
        .attr("transform", `translate(${cx}, ${cy})`)
        .selectAll("path")
        .data(pie(pieData))
        .join("path")
        .attr("d", arc)
        .attr("fill", d => d3.color(d.data.gender === "Female" ? "#ea8db1" : "#418fc7").copy({opacity: 0.4}))
        .attr("stroke", d => d3.color(d.data.gender === "Female" ? "#ea8db1" : "#418fc7").copy({opacity: 0.8}))
        .attr("stroke-width", 2 / map_zoomLevel);
};

const createMapBubbles = (group, cx, cy, radius, country, className) => {
    group.append("circle")
        .attr("class", className)
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", radius)
        .attr("fill", () => {
            const color = map_bubbleColor(country);
            return d3.color(color).copy({opacity: 0.7});
        })
        .attr("stroke", "white")
        .attr("stroke-width", 2 / map_zoomLevel)
        .on("mouseover", function () {
            d3.select(this).attr("stroke", "black");
        })
        .on("mouseout", function () {
            d3.select(this).attr("stroke", "white");
        });
};

function updateMapDimensions() {
    map_width = window.innerWidth;

    // Update SVG dimensions
    map_svg.attr("width", map_width).attr("height", map_height);

    // Update projection
    projection
        .scale((map_width + map_height) / 2 / Math.PI)
        .translate([map_width / 2, map_height / 2]);

    // Update map paths
    map_group.selectAll("path")
        .attr("d", path);

    // Update bubble positions
    map_group.selectAll("circle")
        .attr("cx", d => {
            const coords = projection([d.longitude, d.latitude]);
            return coords ? coords[0] : null;
        })
        .attr("cy", d => {
            const coords = projection([d.longitude, d.latitude]);
            return coords ? coords[1] : null;
        });

    updateMap();
    addMapLegend()
}