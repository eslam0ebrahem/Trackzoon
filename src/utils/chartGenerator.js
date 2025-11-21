// bot/utils/chartGenerator.js
import QuickChart from 'quickchart-js';

/**
 * Generate enhanced price history chart with annotations
 */
async function generatePriceHistoryChart(productName, history, thresholdPrice = null) {
  if (!history || history.length === 0) {
    return null;
  }

  const labels = history.map(h => new Date(h.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  }));
  const data = history.map(h => h.price);

  const avgPrice = data.reduce((a, b) => a + b, 0) / data.length;
  const highPrice = Math.max(...data);
  const lowPrice = Math.min(...data);
  const currentPrice = data[data.length - 1];
  const priceChange = data.length > 1 ? currentPrice - data[0] : 0;
  const priceChangePercent = data.length > 1 ? ((priceChange / data[0]) * 100).toFixed(1) : 0;

  const chart = new QuickChart();
  
  // Build datasets
  const datasets = [
    {
      label: 'Price',
      data,
      borderColor: 'rgb(54, 162, 235)',
      backgroundColor: 'rgba(54, 162, 235, 0.1)',
      fill: true,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      tension: 0.3
    },
    {
      label: 'Average',
      data: Array(data.length).fill(avgPrice),
      borderColor: 'rgba(255, 159, 64, 0.6)',
      borderWidth: 2,
      borderDash: [5, 5],
      fill: false,
      pointRadius: 0
    }
  ];

  // Add threshold line if provided
  if (thresholdPrice) {
    datasets.push({
      label: 'Target Price',
      data: Array(data.length).fill(thresholdPrice),
      borderColor: 'rgba(75, 192, 192, 0.8)',
      borderWidth: 2,
      borderDash: [10, 5],
      fill: false,
      pointRadius: 0
    });
  }

  chart.setConfig({
    type: 'line',
    data: {
      labels,
      datasets
    },
    options: {
      title: {
        display: true,
        text: `${productName.substring(0, 60)}${productName.length > 60 ? '...' : ''}\nCurrent: £${currentPrice.toFixed(2)} (${priceChange >= 0 ? '+' : ''}${priceChangePercent}%) | Avg: £${avgPrice.toFixed(2)} | Low: £${lowPrice.toFixed(2)} | High: £${highPrice.toFixed(2)}`,
        fontSize: 13,
        fontColor: priceChange < 0 ? '#28a745' : priceChange > 0 ? '#dc3545' : '#6c757d'
      },
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          fontSize: 11,
          boxWidth: 15
        }
      },
      scales: {
        yAxes: [{
          ticks: {
            callback: (value) => '£' + value.toFixed(2),
            fontSize: 11
          }
        }],
        xAxes: [{
          ticks: {
            fontSize: 10,
            maxRotation: 45,
            minRotation: 0
          }
        }]
      }
    }
  }).setWidth(700).setHeight(350);

  return chart.getShortUrl();
}

/**
 * Generate savings summary chart
 */
async function generateSavingsChart(totalSavings, savingsBreakdown) {
  const chart = new QuickChart();
  
  chart.setConfig({
    type: 'doughnut',
    data: {
      labels: Object.keys(savingsBreakdown),
      datasets: [{
        data: Object.values(savingsBreakdown),
        backgroundColor: [
          'rgba(75, 192, 192, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(153, 102, 255, 0.8)'
        ],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      title: {
        display: true,
        text: `Total Savings: £${totalSavings.toFixed(2)}`,
        fontSize: 16,
        fontColor: '#28a745'
      },
      legend: {
        display: true,
        position: 'bottom'
      },
      plugins: {
        datalabels: {
          formatter: (value) => '£' + value.toFixed(2),
          color: '#fff',
          font: {
            weight: 'bold',
            size: 12
          }
        }
      }
    }
  }).setWidth(600).setHeight(400);

  return chart.getShortUrl();
}

/**
 * Generate price comparison chart for multiple products
 */
async function generateComparisonChart(products) {
  if (!products || products.length === 0) {
    return null;
  }

  const chart = new QuickChart();
  const colors = [
    'rgb(54, 162, 235)',
    'rgb(255, 99, 132)',
    'rgb(75, 192, 192)',
    'rgb(255, 206, 86)',
    'rgb(153, 102, 255)'
  ];

  const productNames = products.map(p => p.name.substring(0, 25) + (p.name.length > 25 ? '...' : ''));
  const currentPrices = products.map(p => p.currentPrice);
  const avgPrices = products.map(p => {
    const prices = p.priceHistory.map(h => h.price);
    return prices.reduce((a, b) => a + b, 0) / prices.length;
  });

  chart.setConfig({
    type: 'bar',
    data: {
      labels: productNames,
      datasets: [
        {
          label: 'Current Price',
          data: currentPrices,
          backgroundColor: colors.map(c => c.replace('rgb', 'rgba').replace(')', ', 0.8)')),
          borderColor: colors,
          borderWidth: 2
        },
        {
          label: 'Average Price',
          data: avgPrices,
          backgroundColor: 'rgba(255, 159, 64, 0.3)',
          borderColor: 'rgb(255, 159, 64)',
          borderWidth: 2,
          borderDash: [5, 5]
        }
      ]
    },
    options: {
      title: {
        display: true,
        text: 'Price Comparison',
        fontSize: 16
      },
      legend: {
        display: true,
        position: 'top'
      },
      scales: {
        yAxes: [{
          ticks: {
            callback: (value) => '£' + value.toFixed(2),
            beginAtZero: true
          }
        }]
      }
    }
  }).setWidth(700).setHeight(400);

  return chart.getShortUrl();
}

export { 
  generatePriceHistoryChart,
  generateSavingsChart,
  generateComparisonChart
};
