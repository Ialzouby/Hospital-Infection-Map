// Set dimensions and margins for the SVG
const width = 960;
const height = 600;

let currentSelectedState = null; // Holds the name of the currently selected state


// Append an SVG to the map div and create a group to hold the map elements
const svg = d3.select("#map")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

const mapGroup = svg.append("g"); // Group for zoom/pan
const hospitalGroup = svg.append("g"); // Group for hospitals

// Define a color scale for infection counts
const colorScale = d3.scaleSequential(d3.interpolateBlues)
    .domain([500, 90000]); // Adjust max domain value based on infection data

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
    const infectionByState = {};
    infectionData.forEach(d => {
        const state = d.state;
        const score = +d.score;
        infectionByState[state] = (infectionByState[state] || 0) + score;
    });

    // Populate filter dropdown with unique infection types
    const infectionTypes = Array.from(new Set(infectionData.map(d => normalizeInfectionName(d.measure_name))));
    const filterDropdown = d3.select('#filter');
    //filterDropdown.append("option").attr("value", "all").text("All Infections");
    infectionTypes.forEach(type => {
        filterDropdown.append("option").attr("value", type).text(type);
    });

    // Define projection and path generator
    const projection = d3.geoAlbersUsa()
        .translate([width / 2, height / 2])
        .scale(1000);
    const path = d3.geoPath().projection(projection);

    // Bind data and create one path per GeoJSON feature
    const states = mapGroup.selectAll("path")
        .data(geoData.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", d => {
            const state = d.properties.NAME;
            const infectionCount = infectionByState[state];
            return infectionCount ? colorScale(infectionCount) : "#eee"; // Fill color based on infection count
        })
        .attr("stroke", "#333")
        .attr("stroke-width", 0.5)
        .on("mouseover", function(event, d) {
            const state = d.properties.NAME;
            const infectionCount = infectionByState[state] || "No data";
            tooltip.style("display", "block")
                .html(`<strong>${state}</strong><br>Infections: ${infectionCount}`);
            d3.select(this).attr("stroke", "black").attr("stroke-width", 1);
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("display", "none");
            d3.select(this).attr("stroke", "#333").attr("stroke-width", 0.5);
        })
        .on("click", zoomToState); 

    // Zoom function update: sync zoom with hospitals and map
    const zoom = d3.zoom()
        .scaleExtent([1, 8]) // Define zoom limits
        .on("zoom", (event) => {
            // Apply zoom transformation to the map and hospitals
            mapGroup.attr("transform", event.transform);
            //hospitalGroup.attr("transform", event.transform); // Apply the same transformation directly
            // Reposition the hospital markers with scaling their size
            hospitalGroup.selectAll("circle")
                .attr("transform", event.transform)
                .attr("r", 5 / event.transform.k); // Adjust radius based on zoom scale (1/k)
        });

            
    svg.call(zoom); // Apply zoom behavior to the SVG

    // Zoom-to-State function (focus on clicked state and gray out others)
    function zoomToState(event, d) {
        const stateName = d.properties.NAME;
        currentSelectedState = stateName; // Update the global variable
    
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
    
        // Get bounds of the selected state and zoom in
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
    
        // Normalize infection names
        const normalizedData = infectionData.map(d => ({
            ...d,
            measure_name: normalizeInfectionName(d.measure_name)
        }));
    
        // Filter data by state
        const filteredData = selectedType === "all"
            ? normalizedData.filter(d => d.state === stateName) // Include all infections
            : normalizedData.filter(d => d.state === stateName && d.measure_name === selectedType);
    
        // If "all" is selected, aggregate infection counts by hospital
        const aggregatedData = selectedType === "all"
            ? Array.from(
                d3.rollup(
                    filteredData,
                    group => d3.sum(group, d => +d.score || 0), // Sum infection scores
                    d => d.hospital_id // Group by hospital ID
                ),
                ([hospital_id, totalScore]) => ({
                    hospital_id,
                    totalScore,
                    lon: filteredData.find(d => d.hospital_id === hospital_id)?.lon,
                    lat: filteredData.find(d => d.hospital_id === hospital_id)?.lat
                })
            )
            : filteredData; // Use filtered data as-is for specific infection type
    
        // Remove any existing hospital markers
        hospitalGroup.selectAll("circle").remove();
    
        // Add new hospital circles
        hospitalGroup.selectAll("circle")
            .data(aggregatedData, d => d.hospital_id)
            .enter()
            .append("circle")
            .attr("cx", d => {
                const coords = projection([+d.lon, +d.lat]); // Use coordinates
                return coords ? coords[0] : null; // Ensure valid coordinates
            })
            .attr("cy", d => {
                const coords = projection([+d.lon, +d.lat]);
                return coords ? coords[1] : null;
            })
            .attr("r", 5)
            .attr("fill", "red")
            .attr("opacity", 0.7)
            .on("mouseover", (event, d) => {
                tooltip.style("display", "block")
                    .html(`<strong>${d.hospital_id}</strong><br>
                           ${selectedType === "all" ? `All Infections: ${d.totalScore}` :
                             `Infection Type: ${d.measure_name}<br>Count: ${d.score || "No data"}`}`);
            })
            .on("mousemove", (event) => {
                tooltip.style("left", `${event.pageX + 10}px`)
                       .style("top", `${event.pageY - 20}px`);
            })
            .on("mouseout", () => {
                tooltip.style("display", "none");
            });
            
    }
    
    
    
        // Calculate "all" infection count by aggregating across all infection types
        function calculateAllInfections(stateName) {
            const aggregatedInfections = {};

            infectionData.forEach(d => {
                const normalizedType = normalizeInfectionName(d.measure_name);
                const state = d.state;
                if (state === stateName) {
                    aggregatedInfections[normalizedType] = (aggregatedInfections[normalizedType] || 0) + +d.score;
                }
            });

            // Return total sum of all infections for the state
            return Object.values(aggregatedInfections).reduce((sum, count) => sum + count, 0);
        }
        filterDropdown.on("change", () => {
            if (currentSelectedState) {
                // Update the hospital pins for the currently selected state
                showHospitals(currentSelectedState);
        
                // Reapply the zoom and fill logic for the selected state
                const selectedState = geoData.features.find(
                    d => d.properties.NAME === currentSelectedState
                );
                if (selectedState) {
                    const [[x0, y0], [x1, y1]] = path.bounds(selectedState);
                    const dx = x1 - x0;
                    const dy = y1 - y0;
                    const x = (x0 + x1) / 2;
                    const y = (y0 + y1) / 2;
                    const scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height)));
                    const translate = [width / 2 - scale * x, height / 2 - scale * y];
        
                    svg.transition()
                        .duration(750)
                        .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
                }
            }
        });
        
        
        
    
        d3.select("#resetButton").on("click", () => {
            currentSelectedState = null; // Reset the global variable
        
            // Reset zoom
            svg.transition()
                .duration(750)
                .call(zoom.transform, d3.zoomIdentity);
        
            // Reset colors for all states 
            states.transition().duration(750)
                .attr("fill", d => {
                    const state = d.properties.NAME;
                    const infectionCount = infectionByState[state];
                    return infectionCount ? colorScale(infectionCount) : "#eee";
                })
                .attr("opacity", 1);
        
            // Remove all hospital circles when reset is clicked
            hospitalGroup.selectAll("circle").remove();
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

}).catch(error => {
    console.error("Error loading data:", error);
    

});

// Relative path to the hospital icon PNG
const hospitalIconUrl = "hospital-icon.png"; // Ensure this is the correct file name

// Assuming you have a D3 selection for your map
d3.select("#map")
  .selectAll("image")
  .data(hospitals) // Replace with your data array
  .enter()
  .append("image") // Use "image" instead of "svg:image"
  .attr("xlink:href", hospitalIconUrl) // Use the PNG image URL
  .attr("width", 20) // Adjust size as needed
  .attr("height", 20)
  .attr("x", d => projection([d.longitude, d.latitude])[0] - 10) // Adjust positioning
  .attr("y", d => projection([d.longitude, d.latitude])[1] - 10);