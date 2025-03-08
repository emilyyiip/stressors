// Set chart dimensions
const width = 500,
      height = 500,
      radius = Math.min(width, height) / 2;

// Create the main SVG
let svg = d3.select("#main-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

// Ordinal color scale for categories
const color = d3.scaleOrdinal(d3.schemeCategory10);

// Arc and pie generator
const arc = d3.arc().innerRadius(0).outerRadius(radius);
const pie = d3.pie().value(d => d.value);

// Create a legend container
const legendContainer = d3.select("#main-chart")
    .append("div")
    .attr("class", "legend");

// Create a tooltip DIV for the pie chart
const tooltip = d3.select("#main-chart")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0)
    .style("position", "absolute")
    .style("background", "#fff")
    .style("padding", "6px")
    .style("border", "1px solid #ccc")
    .style("border-radius", "4px");

// Load the data
d3.csv("vitaldb_cases.csv").then(data => {
    // Convert numeric fields
    data.forEach(d => {
        d.age = +d.age;
        d.death_inhosp = +d.death_inhosp;
    });

    // Helper to bucket ages into 10-year groups
    function getAgeGroup(age) {
        return Math.floor(age / 10) * 10;
    }

    // Main update function
    function updateChart(selectedAgeGroup, selectedMetric) {
        const filteredData = data.filter(d => getAgeGroup(d.age) === selectedAgeGroup);
        let categoryCounts;

        // Aggregate data based on selected metric
        if (selectedMetric === "mortality") {
            categoryCounts = d3.rollups(filteredData, v => v.length, d => d.death_inhosp);
            categoryCounts = [
                { label: "No Mortality", value: categoryCounts.find(d => d[0] === 0)?.[1] || 0, color: "#4daf4a" },
                { label: "Mortality",   value: categoryCounts.find(d => d[0] === 1)?.[1] || 0, color: "#e41a1c" }
            ];
        } else if (selectedMetric === "optype") {
            categoryCounts = d3.rollups(filteredData, v => v.length, d => d.optype)
                .map(d => ({
                    label: d[0],
                    value: d[1],
                    color: color(d[0])
                }));
        } else if (selectedMetric === "ane_type") {
            categoryCounts = d3.rollups(filteredData, v => v.length, d => d.ane_type)
                .map(d => ({
                    label: d[0],
                    value: d[1],
                    color: color(d[0])
                }));
        }

        // ----- Pie Chart -----
        function pieChart(categoryCounts) {
            // Clear previous chart
            svg.html("");

            // Sum of all values (for percentages)
            const total = d3.sum(categoryCounts, d => d.value);

            // Bind data
            const arcs = svg.selectAll(".arc")
                .data(pie(categoryCounts));

            // ENTER + UPDATE arcs
            arcs.enter()
                .append("path")
                .attr("class", "arc")
                .merge(arcs)
                .transition().duration(500)
                .attr("d", arc)
                .attr("fill", d => d.data.color);

            // Add tooltip interactions
            svg.selectAll(".arc")
                .on("mouseover", (event, d) => {
                    tooltip.style("opacity", 1);
                    const percent = ((d.data.value / total) * 100).toFixed(1);
                    tooltip.html(`<strong>${d.data.label}:</strong> ${percent}%`)
                        .style("left", event.pageX + "px")
                        .style("top", event.pageY + "px");
                })
                .on("mousemove", (event) => {
                    tooltip.style("left", event.pageX + "px")
                           .style("top", event.pageY + "px");
                })
                .on("mouseout", () => {
                    tooltip.style("opacity", 0);
                });

            arcs.exit().remove();

            // Create the legend
            legendContainer.html("");
            categoryCounts.forEach(d => {
                const legendItem = legendContainer.append("div")
                    .style("display", "flex")
                    .style("align-items", "center")
                    .style("margin", "5px 0");

                legendItem.append("div")
                    .style("width", "20px")
                    .style("height", "20px")
                    .style("border-radius", "5px")
                    .style("background-color", d.color)
                    .style("margin-right", "10px");

                legendItem.append("span")
                    .style("color", d.color)
                    .style("font-weight", "bold")
                    .text(d.label);
            });
        }

        // ----- Bar Chart -----
        function updateBarChart(age) {
            // Clear previous chart
            svg.html("");
            legendContainer.html("");

            // Calculate frequency of each age group
            let age_groups = data.map(d => getAgeGroup(d.age));
            const counts = d3.rollup(age_groups, v => v.length, d => d);
            const age_counts = Array.from(counts, ([category, value]) => ({ category, value }));

            // Sort in ascending age order
            age_counts.sort((a, b) => a.category - b.category);

            // Basic margins for bar chart
            let margin_bar = { top: -200, right: 50, bottom: 250, left: -100 };
            let margin_width = 300;
            let margin_height = 300;

            // Create scales
            const x = d3.scaleBand()
                        .domain(age_counts.map(d => d.category))
                        .range([margin_bar.left, margin_width - margin_bar.right])
                        .padding(0.2);

            const y = d3.scaleLinear()
                        .domain([0, d3.max(age_counts, d => d.value)])
                        .nice()
                        .range([margin_height - margin_bar.bottom, margin_bar.top]);

            // Append X axis
            svg.append("g")
                .attr("transform", `translate(0, ${margin_height - margin_bar.bottom})`)
                .call(d3.axisBottom(x));

            // Append Y axis
            svg.append("g")
                .attr("transform", `translate(${margin_bar.left}, 0)`)
                .call(d3.axisLeft(y));

            // Draw bars
            svg.selectAll("rect")
                .data(age_counts)
                .enter().append("rect")
                .attr("x", d => x(d.category))
                .attr("y", d => y(d.value))
                .attr("height", d => y(0) - y(d.value))
                .attr("width", x.bandwidth())
                .attr("fill", d => d.category === age ? "red" : "steelblue");

            // Add bar labels
            svg.selectAll("text.label")
                .data(age_counts)
                .enter().append("text")
                .attr("class", "label")
                .attr("x", d => x(d.category) + x.bandwidth() / 2)
                .attr("y", d => y(d.value) - 5)
                .attr("text-anchor", "middle")
                .text(d => d.value);
        }

        // Decide which chart to show
        if (
            selectedMetric === "optype" ||
            selectedMetric === "ane_type" ||
            selectedMetric === "mortality"
        ) {
            pieChart(categoryCounts);
        } else if (selectedMetric === "count") {
            updateBarChart(selectedAgeGroup);
        }
    }

    // Create a dropdown for choosing the metric
    d3.select("#controls")
      .append("select")
      .attr("id", "metric-selector")
      .selectAll("option")
      .data(["mortality", "optype", "ane_type", "count"])
      .enter()
      .append("option")
      .attr("value", d => d)
      .text(d =>
        d === "mortality" ? "Mortality"
          : d === "optype" ? "Operation Type"
          : d === "ane_type" ? "Anesthesia Type"
          : "Count"
      );

    // Create a range slider for selecting the age group (0–90, step 10)
    d3.select("#slider-container")
      .append("input")
      .attr("type", "range")
      .attr("min", 0)
      .attr("max", 90)
      .attr("step", 10)
      .attr("value", 0)
      .on("input", function () {
          const selectedAge = +this.value;
          const selectedMetric = d3.select("#metric-selector").node().value;
          d3.select("#age-display").text(`Age Group: ${selectedAge}-${selectedAge + 9}`);
          updateChart(selectedAge, selectedMetric);
      });

    // A small text display below the slider
    d3.select("#slider-container")
      .append("div")
      .attr("id", "age-display")
      .text("Age Group: 0-9");

    // Update chart when metric changes
    d3.select("#metric-selector")
      .on("change", function () {
          const selectedAge = +d3.select("#slider-container input").node().value;
          updateChart(selectedAge, this.value);
      });

    // Initialize the chart with default metric
    updateChart(0, "mortality");
});
