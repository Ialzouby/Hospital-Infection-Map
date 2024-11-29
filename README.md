# 🏥 Hospital Infection Visualization

<div style="display: flex; justify-content: space-between;">
    <img src="path/to/your/image1.png" alt="Image 1" style="width: 32%;"/>
    <img src="path/to/your/image2.png" alt="Image 2" style="width: 32%;"/>
    <img src="path/to/your/image3.png" alt="Image 3" style="width: 32%;"/>
</div>

Welcome to the Hospital Infection Visualization project! This interactive map allows you to explore infection data across hospitals in the United States, providing insights into healthcare trends and infection rates.

## ✨ Features

- 🗺️ **Interactive Map**: Explore a detailed map of the United States with state boundaries.
- 🏥 **Hospital Data**: Visualize infection counts by hospital.
- 🔍 **Filter by Infection Type**: Use a dropdown menu to filter infections by type.
- 🔎 **Zoom and Pan**: Easily zoom into states and pan across the map for detailed exploration.
- 💬 **Tooltips**: Hover over hospitals to see detailed infection data.

## 📊 Data Structure

The data used in this project is expected to be in CSV format with the following columns:

- **hospital_id**: Unique identifier for each hospital.
- **state**: The state where the hospital is located.
- **measure_name**: The type of infection.
- **score**: The count of infections.
- **lon**: Longitude of the hospital.
- **lat**: Latitude of the hospital.

## 🚀 Setup Instructions

1. **Clone the Repository**

   ```bash
   git clone https://github.com/yourusername/hospital-infection-visualization.git
   cd hospital-infection-visualization
   ```

2. **Install Dependencies**

   Ensure you have a local server to serve the files, as D3.js requires a server to load data files. You can use Python's built-in server:

   ```bash
   # For Python 3.x
   python -m http.server
   ```

3. **Open the Project**

   Open your web browser and navigate to `http://localhost:8000` to view the project.

## 🛠️ Usage

- **Filter Infections**: Use the dropdown menu to select a specific infection type or view all infections.
- **Zoom and Pan**: Click on a state to zoom in and view detailed hospital data. Use the mouse to pan around the map.
- **Reset View**: Click the "Reset" button to return to the default view.

## 🧑‍💻 Development

This project uses D3.js for data visualization and manipulation. The main JavaScript file is `new.js`, which contains the logic for loading data, rendering the map, and handling user interactions.

### Key Functions

- **`showHospitals(stateName)`**: Displays hospital markers on the map based on the selected state and infection type.
- **`normalizeInfectionName(infectionName)`**: Normalizes infection names for consistent filtering.

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a pull request with your changes.

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 📧 Contact

For questions or feedback, please contact [yourname@example.com](mailto:yourname@example.com).

---

*Thank you for checking out the Hospital Infection Visualization project! We hope it provides valuable insights into healthcare data.* 🌟
