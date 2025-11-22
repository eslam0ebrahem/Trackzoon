export let priceChart;
export let categoryChart;

export function initCharts() {
    // Price Chart
    if (priceChart) priceChart.destroy();
    const ctx = document.getElementById('priceChart').getContext('2d');
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Price (EGP)',
                data: [],
                borderColor: 'rgb(37, 99, 235)',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5,
                tension: 0.4,
                fill: true
            }, {
                label: 'Forecast (EGP)',
                data: [],
                borderColor: 'rgb(16, 185, 129)',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { borderDash: [2, 4], color: 'rgba(156, 163, 175, 0.2)' },
                    ticks: { color: 'rgb(156, 163, 175)' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: 'rgb(156, 163, 175)' }
                }
            }
        }
    });

    // Category Chart
    if (categoryChart) categoryChart.destroy();
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    categoryChart = new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)', // Blue
                    'rgba(16, 185, 129, 0.8)', // Green
                    'rgba(245, 158, 11, 0.8)', // Yellow
                    'rgba(239, 68, 68, 0.8)',  // Red
                    'rgba(139, 92, 246, 0.8)'  // Purple
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } }
            }
        }
    });
}

export function updatePriceChart(labels, data, forecastData = []) {
    priceChart.data.labels = labels;
    priceChart.data.datasets[0].data = data;

    // Pad forecast data with nulls for historical points
    const paddedForecast = new Array(data.length).fill(null);
    // Connect last historical point to first forecast point
    if (data.length > 0 && forecastData.length > 0) {
        paddedForecast[data.length - 1] = data[data.length - 1];
    }
    priceChart.data.datasets[1].data = [...paddedForecast, ...forecastData];

    priceChart.update();
}

export function updateCategoryChart(labels, data) {
    categoryChart.data.labels = labels;
    categoryChart.data.datasets[0].data = data;
    categoryChart.update();
}
