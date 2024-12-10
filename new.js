// Set dimensions and margins for the SVG
const width = 1400;
const height = 600;

let currentSelectedState = null; // Holds the name of the currently selected state

// Append an SVG to the map div and create a group to hold the map elements
const svg = d3.select("#map")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

// Add ocean background
svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "#cce7ff");

// Add gradient ocean
svg.append("defs")
    .append("linearGradient")
    .attr("id", "ocean-gradient")
    .attr("x1", "0%").attr("y1", "0%")
    .attr("x2", "0%").attr("y2", "100%")
    .selectAll("stop")
    .data([
        { offset: "0%", color: "#cce7ff" },
        { offset: "100%", color: "#a2d3f7" }
    ])
    .enter()
    .append("stop")
    .attr("offset", d => d.offset)
    .attr("stop-color", d => d.color);

svg.select("rect").attr("fill", "url(#ocean-gradient)");

const mapGroup = svg.append("g"); // Group for zoom/pan
const hospitalGroup = svg.append("g"); // Group for hospitals

// Define a color scale for infection counts
const colorScale = d3.scaleSequential(d3.interpolateBlues)
    .domain([500, 90000]); // Adjust max domain value if needed

// Define a tooltip
const tooltip = d3.select("body").append("div")
    .attr("id", "tooltip")
    .style("position", "absolute")
    .style("background-color", "white")
    .style("padding", "5px")
    .style("border", "1px solid #ccc")
    .style("border-radius", "4px")
    .style("display", "none");

// Infection name normalization function
const infectionMapping = {
    "MRSA Observed Cases": "MRSA bacteremia",
    "MRSA Bacteremia: Observed Cases": "MRSA bacteremia",
    "C.diff Observed Cases": "Clostridium Difficile",
    "Clostridium Difficile (C.Diff): Observed Cases": "Clostridium Difficile",
    "CLABSI: Observed Cases": "CLABSI",
    "Central Line Associated Bloodstream Infection (ICU + select Wards): Observed Cases": "CLABSI",
    "CAUTI: Observed Cases": "CAUTI",
    "Catheter Associated Urinary Tract Infections (ICU + select Wards): Observed Cases": "CAUTI",
    "SSI: Colon Observed Cases": "SSI: Colon",
    "SSI - Colon Surgery: Observed Cases": "SSI: Colon",
    "SSI: Abdominal Observed Cases": "SSI: Abdominal",
    "SSI - Abdominal Hysterectomy: Observed Cases": "SSI: Abdominal",
};

function normalizeInfectionName(infectionName) {
    return infectionMapping[infectionName] || infectionName;
}

// Load the GeoJSON data and infection data
Promise.all([
    d3.json("GZ2.geojson"),
    d3.csv("healthcare_data.csv")
]).then(([geoData, infectionData]) => {

    // Process infection data by state
    let infectionByState = {};
    infectionData.forEach(d => {
        const state = d.state;
        const score = +d.score;
        infectionByState[state] = (infectionByState[state] || 0) + score;
    });

    // Populate filter dropdown with unique infection types
    const infectionTypes = Array.from(new Set(infectionData.map(d => normalizeInfectionName(d.measure_name))));
    const filterDropdown = d3.select('#filter');
    infectionTypes.forEach(type => {
        filterDropdown.append("option").attr("value", type).text(type);
    });

    // Define projection and path generator
    const projection = d3.geoAlbersUsa()
        .translate([width / 2, height / 2])
        .scale(1100);
    const path = d3.geoPath().projection(projection);

    // Draw states
    const states = mapGroup.selectAll("path")
        .data(geoData.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", d => {
            const state = d.properties.NAME;
            const infectionCount = infectionByState[state];
            return infectionCount ? colorScale(infectionCount) : "#eee";
        })
        .attr("stroke", "#333")
        .attr("stroke-width", 0.5)
        .on("mouseover", function (event, d) {
            const state = d.properties.NAME;
            const infectionCount = infectionByState[state] || "No data";
            tooltip.style("display", "block")
                .html(`<strong>${state}</strong><br>Infections: ${infectionCount}`);
            d3.select(this).attr("stroke", "black").attr("stroke-width", 1);
        })
        .on("mousemove", function (event) {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function () {
            tooltip.style("display", "none");
            d3.select(this).attr("stroke", "#333").attr("stroke-width", 0.5);
        })
        .on("click", zoomToState);

    // Zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .on("zoom", (event) => {
            mapGroup.attr("transform", event.transform);
            hospitalGroup.selectAll("circle")
                .attr("transform", event.transform)
                .attr("r", 5 / event.transform.k);
        });

    svg.call(zoom);

    // Zoom to selected state
    function zoomToState(event, d) {
        const stateName = d.properties.NAME;
        currentSelectedState = stateName;

        // Gray out other states
        states.attr("fill", feature => {
            const featureState = feature.properties.NAME;
            if (featureState === stateName) {
                const infectionCount = infectionByState[featureState];
                return infectionCount ? colorScale(infectionCount) : "#eee";
            } else {
                return "#ccc";
            }
        });

        // Zoom in on the selected state
        const [[x0, y0], [x1, y1]] = path.bounds(d);
        const dx = x1 - x0;
        const dy = y1 - y0;
        const x = (x0 + x1) / 2;
        const y = (y0 + y1) / 2;
        const scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height)));
        const translate = [width / 2 - scale * x, height / 2 - scale * y];

        svg.transition()
            .duration(750)
            .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));

        showHospitals(stateName);
    }

    function showHospitals(stateName) {
        const selectedType = d3.select("#filter").node().value;

        // Filter data for the selected state
        const stateData = infectionData.filter(d => d.state === stateName);

        // Aggregate infection data by hospital
        const aggregatedData = aggregateInfectionData(stateData, selectedType);

        // Remove any existing hospital markers
        hospitalGroup.selectAll("circle").remove();

        // Get the current zoom transform
        const currentTransform = d3.zoomTransform(svg.node());

        // Add new hospital circles
        hospitalGroup.selectAll("circle")
            .data(aggregatedData, d => d.hospital_id)
            .enter()
            .append("circle")
            .attr("cx", d => {
                const coords = projection([+d.lon, +d.lat]);
                return coords ? coords[0] : null;
            })
            .attr("cy", d => {
                const coords = projection([+d.lon, +d.lat]);
                return coords ? coords[1] : null;
            })
            .attr("r", 5 / currentTransform.k)
            .attr("fill", "red")
            .attr("opacity", 0.7)
            .attr("transform", currentTransform)
            .on("mouseover", (event, d) => {
                const selectedType = d3.select("#filter").node().value;

                let latestBenchmark;
                let mostFrequentBenchmark;

                if (selectedType === "all") {
                    const hospitalData = infectionData.filter(row => row.hospital_id === d.hospital_id);
                    const benchmarkCounts = d3.rollup(
                        hospitalData,
                        v => v.length,
                        row => row.compared_to_national
                    );
                    mostFrequentBenchmark = Array.from(benchmarkCounts)
                        .reduce((mostCommon, current) => current[1] > mostCommon[1] ? current : mostCommon, ["No data", 0])[0];

                    if (hospitalData.length > 0) {
                        const latestData = hospitalData.reduce((latest, current) => {
                            return new Date(current.start_date) > new Date(latest.start_date) ? current : latest;
                        });
                        latestBenchmark = latestData.compared_to_national;
                    } else {
                        latestBenchmark = "No data";
                    }
                } else {
                    const hospitalData = infectionData.filter(
                        row => row.hospital_id === d.hospital_id && normalizeInfectionName(row.measure_name) === selectedType
                    );
                    const benchmarkCounts = d3.rollup(
                        hospitalData,
                        v => v.length,
                        row => row.compared_to_national
                    );
                    mostFrequentBenchmark = Array.from(benchmarkCounts)
                        .reduce((mostCommon, current) => current[1] > mostCommon[1] ? current : mostCommon, ["No data", 0])[0];

                    if (hospitalData.length > 0) {
                        const latestData = hospitalData.reduce((latest, current) => {
                            return new Date(current.start_date) > new Date(latest.start_date) ? current : latest;
                        });
                        latestBenchmark = latestData.compared_to_national;
                    } else {
                        latestBenchmark = "No data";
                    }
                }

                tooltip.style("display", "block")
                    .html(`<strong>${d.hospital_id}</strong><br>
                           ${selectedType === "all" ? `All Infections: ${d.totalScore}` :
                            `Infection Type: ${selectedType}<br>Count: ${d.totalScore || "No data"}`}<br>
                           Latest Benchmark: ${latestBenchmark}<br>
                           Most Frequent Benchmark: ${mostFrequentBenchmark}`);
            })
            .on("mousemove", (event) => {
                tooltip.style("left", `${event.pageX + 10}px`)
                    .style("top", `${event.pageY - 20}px`);
            })
            .on("mouseout", () => {
                tooltip.style("display", "none");
            })
            .on("click", (event, d) => {
                openModal(d.hospital_id);
            });
    }

    function aggregateInfectionData(infectionData, selectedType) {
        const parseDate = d3.timeParse("%m/%d/%y");
        const normalizedData = infectionData.map(d => ({
            ...d,
            measure_name: normalizeInfectionName(d.measure_name),
            score: +d.score || 0,
            compared_to_national: d.compared_to_national || "No data",
            date: parseDate(d.start_date)
        }));

        const filteredData = selectedType === "all"
            ? normalizedData
            : normalizedData.filter(d => d.measure_name === selectedType);

        const aggregatedData = Array.from(
            d3.rollup(
                filteredData,
                group => {
                    const mostRecentEntry = group.reduce((latest, current) => current.date > latest.date ? current : latest);
                    return {
                        totalScore: d3.sum(group, d => d.score),
                        compared_to_national: mostRecentEntry.compared_to_national
                    };
                },
                d => d.hospital_id,
                d => d.measure_name
            ),
            ([hospital_id, infectionMap]) => ({
                hospital_id,
                totalScore: selectedType === "all"
                    ? Array.from(infectionMap.values()).reduce((sum, { totalScore }) => sum + totalScore, 0)
                    : (infectionMap.get(selectedType)?.totalScore || 0),
                compared_to_national: selectedType === "all"
                    ? "Varies"
                    : (infectionMap.get(selectedType)?.compared_to_national || "No data"),
                lon: filteredData.find(d => d.hospital_id === hospital_id)?.lon,
                lat: filteredData.find(d => d.hospital_id === hospital_id)?.lat
            })
        );

        return aggregatedData;
    }

    function filterDataByYearAndType(infectionData, selectedYear, selectedType) {
        return infectionData.filter(d => {
            const year = d.start_date.split('/')[2];
            const infectionTypeMatch = (selectedType === "all" || normalizeInfectionName(d.measure_name) === selectedType);
            const yearMatch = (selectedYear === "all" || year === selectedYear);
            return infectionTypeMatch && yearMatch;
        });
    }

// After loading infectionData and processing it as usual:

// Extract and sort years
const years = Array.from(new Set(infectionData.map(d => d.start_date.split('/')[2]))).sort();

// Create an array that includes "all" at the start
const allValues = ["all", ...years];

const yearSlider = document.getElementById("yearSlider");
const yearLabel = document.getElementById("yearLabel");

// Configure the slider
yearSlider.min = 0;
yearSlider.max = allValues.length - 1;
yearSlider.value = 0; // default to "all" years

// Function to update label and map when the slider value changes
function updateYearLabelAndMap() {
    const selectedIndex = parseInt(yearSlider.value, 10);
    const selectedYear = allValues[selectedIndex];

    // Update the label text
    yearLabel.textContent = (selectedYear === "all") ? "All Years" : selectedYear;

    // Re-run updateMap to apply the new year filter
    updateMap();
}

// Listen for slider changes
yearSlider.addEventListener("input", updateYearLabelAndMap);

// Modify updateMap to use the slider-selected year instead of the dropdown
function updateMap() {
    // Get selected year from slider instead of dropdown
    const selectedIndex = parseInt(yearSlider.value, 10);
    const selectedYear = allValues[selectedIndex];

    // Selected infection type from dropdown remains the same
    const selectedType = d3.select("#filter").node().value;

    // Filter data based on the slider-selected year and current infection type
    const filteredData = filterDataByYearAndType(infectionData, selectedYear, selectedType);

    // Recompute infection counts by state
    infectionByState = {};
    filteredData.forEach(d => {
        const state = d.state;
        const score = +d.score;
        infectionByState[state] = (infectionByState[state] || 0) + score;
    });

    // Update state fills
    states.attr("fill", d => {
        const state = d.properties.NAME;
        const infectionCount = infectionByState[state];
        return infectionCount ? colorScale(infectionCount) : "#eee";
    });

    // Update tooltip content
    states.on("mouseover", function(event, d) {
        const state = d.properties.NAME;
        const infectionCount = infectionByState[state] || "No data";
        tooltip.style("display", "block")
            .html(`<strong>${state}</strong><br>Infections: ${infectionCount}`);
        d3.select(this).attr("stroke", "black").attr("stroke-width", 1);
    })
    .on("mouseout", function() {
        tooltip.style("display", "none");
        d3.select(this).attr("stroke", "#333").attr("stroke-width", 0.5);
    });

    // If a state is currently selected, update the hospitals for that state
    if (currentSelectedState) {
        showHospitals(currentSelectedState);
    }
}

// Initialize the map view with default slider value
updateYearLabelAndMap();

// Remove or comment out lines related to #yearSelect, for example:
// const yearDropdown = d3.select('#yearSelect');
// d3.select("#yearSelect").on("change", updateMap);
// ... etc.


    // Populate dropdowns
    function populateDropdowns(infectionData) {
        const states = Array.from(new Set(infectionData.map(d => d.state))).sort();
        const hospitals = Array.from(new Set(infectionData.map(d => d.hospital_id))).sort();
        const infections = Array.from(new Set(infectionData.map(d => normalizeInfectionName(d.measure_name))));

        populateDropdown("stateSelect", "stateInput", states, (selectedState) => {
            const filteredHospitals = selectedState === "all"
                ? hospitals
                : Array.from(new Set(infectionData.filter(d => d.state === selectedState).map(d => d.hospital_id))).sort();
            updateHospitalDropdown(filteredHospitals);
        });

        populateDropdown("hospitalSelect", "hospitalInput", hospitals);
        populateDropdown("infectionSelect", "infectionInput", infections);
    }

    function populateDropdown(selectId, inputId, options, onOptionChange = () => { }) {
        const select = document.getElementById(selectId);
        const input = document.getElementById(inputId);

        options.forEach(option => {
            const opt = document.createElement("option");
            opt.value = option;
            opt.text = option;
            select.appendChild(opt);
        });

        input.addEventListener("input", () => {
            const filter = input.value.toLowerCase();
            select.innerHTML = "";
            options.filter(option => option.toLowerCase().includes(filter))
                .forEach(option => {
                    const opt = document.createElement("option");
                    opt.value = option;
                    opt.text = option;
                    select.appendChild(opt);
                });

            if (select.options.length > 0) {
                select.selectedIndex = 0;
            }

            const selectedValue = select.options[0]?.value || "";
            onOptionChange(selectedValue);
        });

        select.addEventListener("change", () => {
            input.value = select.value;
            onOptionChange(select.value);
        });
    }

    function updateHospitalDropdown(hospitals) {
        const hospitalSelect = document.getElementById("hospitalSelect");
        const hospitalInput = document.getElementById("hospitalInput");

        hospitalSelect.innerHTML = "";
        hospitalInput.value = "";

        const allOption = document.createElement("option");
        allOption.value = "all";
        allOption.text = "All Hospitals";
        hospitalSelect.appendChild(allOption);

        hospitals.forEach(hospital => {
            const option = document.createElement("option");
            option.value = hospital;
            option.text = hospital;
            hospitalSelect.appendChild(option);
        });

        hospitalInput.addEventListener("input", () => {
            const filter = hospitalInput.value.toLowerCase();
            hospitalSelect.innerHTML = "";
            hospitals
                .filter(hospital => hospital.toLowerCase().includes(filter))
                .forEach(hospital => {
                    const option = document.createElement("option");
                    option.value = hospital;
                    option.text = hospital;
                    hospitalSelect.appendChild(option);
                });

            if (hospitalSelect.options.length > 0) {
                hospitalSelect.selectedIndex = 0;
            }
        });

        hospitalSelect.addEventListener("change", () => {
            hospitalInput.value = hospitalSelect.value;
        });
    }

    function setupDropdownVisibility() {
        const inputs = [
            { inputId: "stateInput", dropdownId: "stateSelect" },
            { inputId: "hospitalInput", dropdownId: "hospitalSelect" },
            { inputId: "infectionInput", dropdownId: "infectionSelect" }
        ];

        inputs.forEach(({ inputId, dropdownId }) => {
            const input = document.getElementById(inputId);
            const dropdown = document.getElementById(dropdownId);

            dropdown.style.display = "none";

            input.addEventListener("focus", () => {
                inputs.forEach(({ dropdownId: otherDropdownId }) => {
                    if (dropdownId !== otherDropdownId) {
                        document.getElementById(otherDropdownId).style.display = "none";
                    }
                });
                dropdown.style.display = "block";
            });

            input.addEventListener("blur", () => {
                setTimeout(() => dropdown.style.display = "none", 200);
            });

            dropdown.addEventListener("change", () => {
                input.value = dropdown.value;
                dropdown.style.display = "none";
            });
        });
    }

    setupDropdownVisibility();

    // Export modal logic
    const exportButton = document.getElementById("exportButton");
    const exportModal = document.getElementById("exportModal");
    const closeModalButton = document.getElementById("closeModalButton");

    exportButton.addEventListener("click", () => {
        exportModal.style.display = "block";
    });

    closeModalButton.addEventListener("click", () => {
        exportModal.style.display = "none";
    });

    document.getElementById("exportCsvButton").addEventListener("click", () => {
        const selectedState = document.getElementById("stateSelect").value;
        const selectedHospital = document.getElementById("hospitalSelect").value;
        const selectedInfection = document.getElementById("infectionSelect").value;

        const filteredData = infectionData.filter(d =>
            (selectedState === "all" || d.state === selectedState) &&
            (selectedHospital === "all" || d.hospital_id === selectedHospital) &&
            (selectedInfection === "all" || normalizeInfectionName(d.measure_name) === selectedInfection)
        );

        const columns = [
            "l", "facility_id", "hospital_id", "address", "city", "state",
            "zip_code", "county_name", "measure_name", "compared_to_national",
            "score", "start_date", "end_date", "original_Address", "lat", "lon"
        ];

        const csvContent = [
            columns.join(","),
            ...filteredData.map(d => columns.map(col => d[col] || "").join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "HA-Infections.csv";
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        exportModal.style.display = "none";
    });

    // Additional dropdown initialization
    populateDropdowns(infectionData);

    document.getElementById("stateSelect").value = "all";
    document.getElementById("hospitalSelect").value = "all";
    document.getElementById("infectionSelect").value = "all";

    function populateInfectionDropdown(infections) {
        const infectionSelect = document.getElementById('infectionSelect');
        infectionSelect.innerHTML = '';
        infections.forEach(infection => {
            const option = document.createElement('option');
            option.value = infection;
            option.textContent = infection;
            infectionSelect.appendChild(option);
        });
    }

    const uniqueInfections = Array.from(new Set(infectionData.map(d => normalizeInfectionName(d.measure_name))));
    populateInfectionDropdown(uniqueInfections);

    d3.select("#stateSelect").on("change", function () {
        const selectedState = this.value;
        const filteredHospitals = selectedState === "all"
            ? Array.from(new Set(infectionData.map(d => d.hospital_id))).sort()
            : Array.from(new Set(infectionData.filter(d => d.state === selectedState).map(d => d.hospital_id))).sort();
        updateHospitalDropdown(filteredHospitals);
    });

    // Reset view
    d3.select("#resetButton").on("click", () => {
        currentSelectedState = null;
        svg.transition()
            .duration(750)
            .call(zoom.transform, d3.zoomIdentity);

        states.transition().duration(750)
            .attr("fill", d => {
                const state = d.properties.NAME;
                const infectionCount = infectionByState[state];
                return infectionCount ? colorScale(infectionCount) : "#eee";
            })
            .attr("opacity", 1);

        hospitalGroup.selectAll("circle").remove();

        d3.select("#filter").property("value", "all");
        d3.select("#yearSelect").property("value", "all");
        updateMap();
    });

    // Add a legend for the color scale
    const legendWidth = 300;
    const legendHeight = 10;

    const legendGroup = svg.append("g")
        .attr("transform", `translate(${width - legendWidth - 50},${height - 60})`);

    legendGroup.append("rect")
        .attr("width", legendWidth + 20)
        .attr("height", legendHeight + 40)
        .attr("fill", "#fff")
        .attr("stroke", "#ccc")
        .attr("rx", 5)
        .attr("ry", 5);

    legendGroup.append("text")
        .attr("x", legendWidth / 2)
        .attr("y", 10)
        .attr("text-anchor", "middle")
        .attr("font-size", 14)
        .text("Infection Counts");

    const legendSvg = svg.append("g")
        .attr("transform", `translate(${width - legendWidth - 20},${height - 30})`);

    const legendScale = d3.scaleLinear()
        .domain(colorScale.domain())
        .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
        .ticks(5)
        .tickSize(6);

    legendSvg.append("g")
        .attr("transform", `translate(0, ${legendHeight + 2})`)
        .call(legendAxis)
        .select(".domain").remove();

    const gradient = legendSvg.append("defs")
        .append("linearGradient")
        .attr("id", "gradient")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "100%").attr("y2", "0%");

    gradient.append("stop").attr("offset", "0%").attr("stop-color", colorScale.range()[0]);
    gradient.append("stop").attr("offset", "100%").attr("stop-color", colorScale.range()[1]);

    legendSvg.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#gradient)");

    updateMap();

}).catch(error => {
    console.error("Error loading data:", error);
});

// Modal and line graph functions
function openModal(hospitalId) {
    const modal = document.getElementById("lineGraphModal");
    const iframe = document.getElementById("lineGraphFrame");

    iframe.src = `multi-series_linegraph-2.html?hospital=${encodeURIComponent(hospitalId)}`;
    modal.style.display = "block";

    const closeButton = document.getElementsByClassName("close")[0];
    closeButton.onclick = () => { modal.style.display = "none"; };

    window.onclick = event => {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    };
}


// After loading infectionData and extracting years:
const years = Array.from(new Set(infectionData.map(d => d.start_date.split('/')[2]))).sort();

// The first step is "All Years", then the years follow
// For example, index 0 = "all", index 1 = first year, etc.
const allValues = ["all", ...years];

const yearSlider = document.getElementById("yearSlider");
const yearLabel = document.getElementById("yearLabel");

// Set slider min, max, and initial value
yearSlider.min = 0;
yearSlider.max = allValues.length - 1;
yearSlider.value = 0; // 0 corresponds to "all"

// Update the label whenever the slider changes
function updateYearLabelAndMap() {
    const selectedIndex = parseInt(yearSlider.value, 10);
    const selectedYear = allValues[selectedIndex];

    // Update the label text
    yearLabel.textContent = selectedYear === "all" ? "All Years" : selectedYear;

    // Update the map with the new selected year and current filter
    updateMap();
}

// Listen for changes on the slider
yearSlider.addEventListener("input", updateYearLabelAndMap);

// Modify updateMap() to get the selected year from the slider instead of dropdown
function updateMap() {
    const selectedIndex = parseInt(yearSlider.value, 10);
    const selectedYear = allValues[selectedIndex];
    const selectedType = d3.select("#filter").node().value;

    const filteredData = filterDataByYearAndType(infectionData, selectedYear, selectedType);

    // Recompute infection counts by state for updated year/type
    infectionByState = {};
    filteredData.forEach(d => {
        const state = d.state;
        const score = +d.score;
        infectionByState[state] = (infectionByState[state] || 0) + score;
    });

    // Update state colors
    states.attr("fill", d => {
        const state = d.properties.NAME;
        const infectionCount = infectionByState[state];
        return infectionCount ? colorScale(infectionCount) : "#eee";
    });

    // Update tooltip content and hospitals if needed
    states.on("mouseover", function (event, d) {
        const state = d.properties.NAME;
        const infectionCount = infectionByState[state] || "No data";
        tooltip.style("display", "block")
            .html(`<strong>${state}</strong><br>Infections: ${infectionCount}`);
        d3.select(this).attr("stroke", "black").attr("stroke-width", 1);
    })
    .on("mouseout", function () {
        tooltip.style("display", "none");
        d3.select(this).attr("stroke", "#333").attr("stroke-width", 0.5);
    });

    if (currentSelectedState) {
        showHospitals(currentSelectedState);
    }
}

// Call updateYearLabelAndMap once to initialize
updateYearLabelAndMap();
