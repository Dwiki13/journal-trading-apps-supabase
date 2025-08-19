import React from "react";
import ReactECharts from "echarts-for-react";

const WinRatePerPair = ({ journal }) => {
  const pairStats = {};

  journal.forEach(row => {
    const pair = row.pair || "Unknown";
    const isWin = String(row.winLose).toLowerCase().trim() === "win";

    if (!pairStats[pair]) {
      pairStats[pair] = { win: 0, lose: 0 };
    }

    if (isWin) {
      pairStats[pair].win++;
    } else {
      pairStats[pair].lose++;
    }
  });

  // Ubah ke array + urutkan berdasarkan win rate tertinggi
  const sortedPairs = Object.entries(pairStats)
    .map(([pair, stats]) => {
      const total = stats.win + stats.lose;
      const winRate = total > 0 ? (stats.win / total) * 100 : 0;
      return { pair, ...stats, winRate };
    })
    .sort((a, b) => b.winRate - a.winRate);

  return (
    <div
  style={{
    display: "flex",
    flexWrap: "nowrap", // tidak pindah baris
    gap: "20px",
    overflowX: "auto", // scroll horizontal kalau kepanjangan
    paddingBottom: "10px"
  }}
>
  {sortedPairs.map(({ pair, win, lose, winRate }) => {
    const option = {
      backgroundColor: "#fff",
      tooltip: {
        trigger: "item",
        formatter: "{b}: {c} ({d}%)",
      },
      series: [
        {
          name: "Win Rate",
          type: "pie",
          radius: ["40%", "70%"],
          label: {
            show: true,
            position: "outside",
            formatter: "{d}%",
          },
          labelLine: { show: true },
          itemStyle: {
            borderRadius: 10,
            shadowBlur: 20,
            shadowOffsetX: 0,
            shadowColor: "rgba(0, 0, 0, 0.5)",
          },
          data: [
            {
              value: win,
              name: "Win",
              itemStyle: { color: "#4CAF50" },
            },
            {
              value: lose,
              name: "Lose",
              itemStyle: { color: "#666666ff" },
            },
          ],
        },
      ],
    };

    return (
      <div
        key={pair}
        style={{
          minWidth: "250px",
          textAlign: "center",
          background: "#fff",
          borderRadius: "10px",
          padding: "10px"
        }}
      >
        <h5>{pair}</h5>
        <ReactECharts option={option} style={{ height: "250px" }} />
      </div>
    );
  })}
</div>

  );
};

export default WinRatePerPair;
