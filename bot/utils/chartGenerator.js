// bot/utils/chartGenerator.js
import QuickChart from 'quickchart-js';

async function generatePriceChart(productName, history) {
  const labels = history.map(h => new Date(h.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  }));
  const data = history.map(h => h.price);

  const avgPrice = data.reduce((a, b) => a + b, 0) / data.length;
  const highPrice = Math.max(...data);
  const lowPrice = Math.min(...data);

  const chart = new QuickChart();
  chart.setConfig({
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `Price History for ${productName}`,
        data,
        borderColor: 'rgb(54, 162, 235)',
        fill: false
      }]
    },
    options: {
      title: {
        display: true,
        text: `Average: €${avgPrice.toFixed(2)} • High: €${highPrice.toFixed(2)} • Low: €${lowPrice.toFixed(2)}`
      }
    }
  }).setWidth(550).setHeight(300);

  return chart.getShortUrl();
}

export { generatePriceChart };
