import React, { useState, useEffect,useRef } from "react";
import axios from "axios";
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Table,
  Card,
  Image,
  Modal
} from "react-bootstrap";
import {
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line
} from "recharts";
import WinRatePerPair from "./WinRatePerPair";
import ReactECharts from "echarts-for-react";
import Swal from "sweetalert2";

function App() {
  const [journal, setJournal] = useState([]);
  const [form, setForm] = useState({
    modal: "",
    modalType: "USD",
    tanggal: "",
    pair: "",
    side: "Buy",
    lot: "",
    hargaEntry: "",
    hargaTakeProfit: "",
    hargaStopLoss: "",
    analisaBefore: null,
    analisaAfter: null,
    reason: "",
    winLose: "Win",
    profit: "",
  });

    useEffect(() => {
    async function fetchJournal() {
      try {
        const res = await axios.get("http://localhost:5000/api/journal");
        setJournal(res.data);
      } catch (err) {
        console.error("Gagal ambil data journal dari backend", err);
      }
    }
    fetchJournal();
  }, []);

  // Kurs state (default null)
  const [usdToIdr, setUsdToIdr] = useState(null);

  // Fetch kurs USD to IDR secara real-time saat mount
  useEffect(() => {
    async function fetchExchangeRate() {
      try {
        const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
        const data = await res.json();
        if (data && data.rates && data.rates.IDR) {
          setUsdToIdr(data.rates.IDR);
          console.log("convers to idr: " ,data.rates.IDR);
        } else {
          console.warn("Data kurs tidak valid, menggunakan fallback 15000");
          setUsdToIdr(15000); // fallback
        }
      } catch (error) {
        console.error("Gagal fetch kurs USD to IDR, menggunakan fallback 15000", error);
        setUsdToIdr(15000); // fallback
      }
    }
    fetchExchangeRate();
  }, []);

  // Handler input form change
  function handleChange(e) {
    const { name, files, value } = e.target;
    if (files) {
      // Buat URL sementara untuk preview
      const file = files[0];
      setForm({
        ...form,
        [name]: file,
        [`${name}Preview`]: URL.createObjectURL(file), // simpan preview URL
      });
    } else {
      setForm({ ...form, [name]: value });
    }
  }


function handleModalTypeChange(e) {
  setForm(prev => ({ ...prev, modalType: e.target.value }));
}

  const beforeRef = useRef(null);
  const afterRef = useRef(null);

  const [show, setShow] = useState(false);
  const [imgSrc, setImgSrc] = useState("");

  const handleOpen = (filename) => {
    setImgSrc(`http://localhost:5000/uploads/${filename}`);
    setShow(true);
  };

  const handleClose = () => setShow(false);

  const handleSubmit = async (e) => {
  e.preventDefault();
  
  const formData = new FormData();
  for (let key in form) {
    if (form[key] !== null) {
      formData.append(key, form[key]);
    }
  }

  try {
    const res = await fetch("http://localhost:5000/api/journal", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    // Reload data journal terbaru dari backend
    const newData = await axios.get("http://localhost:5000/api/journal");
    setJournal(newData.data);
    console.log(data);

     Swal.fire({
      icon: "success",
      title: "Berhasil!",
      text: "Data trading berhasil disimpan.",
      timer: 2000,
      showConfirmButton: false,
    });

    // Reset form
      setForm({
        modal: "",
        modalType: "",
        tanggal: "",
        pair: "",
        side: "Buy",
        lot: "",
        hargaEntry: "",
        hargaTakeProfit: "",
        hargaStopLoss: "",
        analisaBefore: "",
        analisaAfter: "",
        reason: "",
        winLose: "Win",
        profit: "",
      });
    
    if (beforeRef.current) beforeRef.current.value = "";
    if (afterRef.current) afterRef.current.value = "";
  } catch (err) {
    console.error(err);
     Swal.fire({
      icon: "error",
      title: "Gagal!",
      text: "Terjadi kesalahan saat menyimpan data.",
    });
  }
};


  // Jika kurs belum didapat, tampilkan loading atau 0
  const usdToIdrRate = usdToIdr || 15000; // fallback 15000 saat belum ada data
  const centToIdrRate = usdToIdrRate / 100;

  // Hitung total modal dalam IDR
  const modalIDR =
    form.modalType === "USD"
      ? parseFloat(form.modal || 0) * usdToIdrRate
      : parseFloat(form.modal || 0) * centToIdrRate;

  // Summary data for charts
    const wins = journal.filter(j => String(j.winLose).toLowerCase().trim() === "win").length;
    const loses = journal.filter(j => String(j.winLose).toLowerCase().trim() === "lose").length;
    const totalTrades = wins + loses;

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
          value: wins,
          name: "Win",
          itemStyle: { color: "#4CAF50" },
        },
        {
          value: loses,
          name: "Lose",
          itemStyle: { color: "#666666ff" },
        },
      ],
    },
  ],
  };

  // === Helper: hitung running balance USD & IDR sekali saja ===
  const rowsWithBalance = React.useMemo(() => {
    const rate = usdToIdrRate || 15000;
    const enforceSignByWinLose = true;

    let runningUSD = 0;
    let lastModalType = "USD"; // simpan modalType terakhir
    let lastModalValue = 0;    // simpan nilai modal terakhir untuk acuan profit/loss

    return journal.map((raw) => {
      const row = { ...raw };

      const hasModal =
        row.modal !== null &&
        row.modal !== undefined &&
        String(row.modal).trim() !== "" &&
        !isNaN(Number(row.modal)) &&
        Number(row.modal) > 0;

      if (hasModal) {
        lastModalType = row.modalType;
        lastModalValue = Number(row.modal);
      }

      // Konversi modal sesuai modalType
      let modalUSD = 0;
      if (hasModal) {
        modalUSD = lastModalType === "Cent" ? lastModalValue / 100 : lastModalValue;
        runningUSD += modalUSD;
      }

      // Hitung profit/loss sesuai modalType terakhir yang valid
      const profitRaw = Number(row.profit) || 0;
      const isLose = String(row.winLose).toLowerCase().trim() === "lose";

      const profitUSD =
        lastModalType === "Cent"
          ? enforceSignByWinLose
            ? isLose
              ? -Math.abs(profitRaw) / 100
              : Math.abs(profitRaw) / 100
            : profitRaw / 100
          : enforceSignByWinLose
          ? isLose
            ? -Math.abs(profitRaw)
            : Math.abs(profitRaw)
          : profitRaw;

      runningUSD += profitUSD;

      const tanggalLabel = new Date(row.tanggal).toLocaleDateString("id-ID");

      return {
        ...row,
        tanggalLabel,
        modalUSD,
        profitUSD,
        profitIDR: profitUSD * rate,
        balanceUSD: runningUSD,
        balanceIDR: runningUSD * rate,
      };
    });
  }, [journal, usdToIdrRate]);


  // Data bar chart (equity berjalan dalam IDR) – langsung dari rowsWithBalance
  const equityData = rowsWithBalance.map((r) => ({
    tanggal: r.tanggalLabel,
    balance: r.balanceIDR, // angka untuk chart
    balanceLabel: r.balanceIDR.toLocaleString("id-ID", { style: "currency", currency: "IDR" }), // untuk tooltip
  }));

  return (
     <div style={{ backgroundColor: "#1F2937", minHeight: "100vh", padding: "20px" }}>
      <div style={{ position: "relative", minHeight: "100vh", backgroundColor: "#1F2937", padding: "40px" }}>
  
  {/* GIF kiri */}
  <img
    src="ponke-ponkesol.gif"
    alt="GIF Kiri"
    style={{
      position: "absolute",
      left: 0,
      top: "50%",
      transform: "translateY(-50%)",
      width: "150px",
      height: "auto",
      zIndex: 1,
       opacity: 0.6,
    }}
  />

  {/* GIF kanan */}
  <img
    src="mnewbis.gif"
    alt="GIF Kanan"
    style={{
      position: "absolute",
      right: 0,
      top: "50%",
      transform: "translateY(-50%)",
      width: "150px",
      height: "auto",
      zIndex: 1,
    }}
  />
    <Container className="my-4 p-4" style={{ backgroundColor: "#374151", borderRadius: "12px" }}>

      <h2 className="mb-4" style={{color: "#FAFAFA"}}>Trading Journal</h2>

      {/* Modal input */}
    <Card className="mb-4 shadow-sm" style={{ borderRadius: "12px", backgroundColor: "#FAFAFA" }}>
      <Card.Body>
        <Row className="align-items-end">
          <Col md={4}>
            <Form.Group>
              <Form.Label>Modal</Form.Label>
              <Form.Control
                type="number"
                min="0"
                step="0.01"
                value={form.modal}
                onChange={(e) => setForm({ ...form, modal: e.target.value })}
                placeholder="Masukkan modal"
              />
            </Form.Group>
          </Col>
          <Col md={2}>
            <Form.Group>
              <Form.Label>Jenis Modal</Form.Label>
              <Form.Select value={form.modalType} onChange={handleModalTypeChange}>
                <option value="USD">USD</option>
                <option value="Cent">Cent</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <h5 style={{ fontWeight: "600", color: "#333" }}>
              Modal dalam IDR:{" "}
              <strong>
                {isNaN(modalIDR)
                  ? "-"
                  : modalIDR.toLocaleString("id-ID", {
                      style: "currency",
                      currency: "IDR",
                    })}
              </strong>
            </h5>
          </Col>
        </Row>
      </Card.Body>
    </Card>


      {/* Form input */}
    <Card className="mb-4 shadow-sm">
    <Card.Body>
      <Form onSubmit={handleSubmit}>
        <Row className="mb-3">
          <Col md={3}>
            <Form.Group>
              <Form.Label>Tanggal</Form.Label>
              <Form.Control
                type="date"
                name="tanggal"
                value={form.tanggal}
                onChange={handleChange}
                required
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label>Pair</Form.Label>
              <Form.Select
                name="pair"
                value={form.pair}
                onChange={handleChange}
                required
              >
                <option value="">Pilih Pair</option>
                <option value="XAUUSD">XAUUSD</option>
                <option value="XAUUSD">GBPUSD</option>
                <option value="BTCUSD">BTCUSD</option>
                <option value="USDJPY">USDJPY</option>
                <option value="GBPJPY">GBPJPY</option>
                <option value="EURUSD">EURUSD</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={2}>
            <Form.Group>
              <Form.Label>Buy/Sell</Form.Label>
              <Form.Select
                name="side"
                value={form.side}
                onChange={handleChange}
                style={{
                backgroundColor: form.side === "Buy" ? "#d4fdd4" : "#fdd4d4", // hijau muda / merah muda
                color: form.side === "Buy" ? "green" : "red",
                fontWeight: "bold"
              }}
              >
                <option>Buy</option>
                <option>Sell</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={2}>
            <Form.Group>
              <Form.Label>Lot</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                name="lot"
                value={form.lot}
                onChange={handleChange}
                required
              />
            </Form.Group>
          </Col>
          <Col md={2}>
            <Form.Group>
              <Form.Label>Harga Entry</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                name="hargaEntry"
                value={form.hargaEntry}
                onChange={handleChange}
                required
              />
            </Form.Group>
          </Col>
        </Row>

        <Row className="mb-3">
          <Col md={3}>
            <Form.Group>
               <Form.Label>Harga Take Profit</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                name="hargaTakeProfit"
                value={form.hargaTakeProfit}
                onChange={handleChange}
                required
              />
            </Form.Group>
          </Col>

          <Col md={3}>
            <Form.Group>
               <Form.Label>Harga Stop Loss</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                name="hargaStopLoss"
                value={form.hargaStopLoss}
                onChange={handleChange}
                required
              />
            </Form.Group>
          </Col>
          
          <Col md={3}>
            <Form.Group>
              <Form.Label>Gambar Analisa Before</Form.Label>
              <Form.Control
                type="file"
                name="analisaBefore"
                accept="image/*"
                onChange={handleChange}
                ref={beforeRef}
              />
              {form.analisaBefore && (
                <Image
                  src={form.analisaBeforePreview}
                  thumbnail
                  className="mt-2"
                  style={{ maxHeight: "100px" }}
                />
              )}
            </Form.Group>
          </Col>

          <Col md={3}>
            <Form.Group>
              <Form.Label>Gambar Analisa After</Form.Label>
              <Form.Control
                type="file"
                name="analisaAfter"
                accept="image/*"
                onChange={handleChange}
                ref={afterRef}
              />
              {form.analisaAfter && (
                <Image
                  src={form.analisaAfterPreview}
                  thumbnail
                  className="mt-2"
                  style={{ maxHeight: "100px" }}
                />
              )}
            </Form.Group>
          </Col>
        </Row>

        <Row className="mb-4">
           <Col md={3}>
            <Form.Group>
              <Form.Label>Alasan Entry</Form.Label>
              <Form.Control
                type="text"
                name="reason"
                placeholder="Contoh: FVG M15"
                value={form.reason}
                onChange={handleChange}
                required
              />
            </Form.Group>
          </Col>

          <Col md={2}>
            <Form.Group>
              <Form.Label>Win/Lose</Form.Label>
              <Form.Select
                name="winLose"
                value={form.winLose}
                onChange={handleChange}
              >
                <option>Win</option>
                <option>Lose</option>
              </Form.Select>
            </Form.Group>
          </Col>

          <Col md={2}>
            <Form.Group>
              <Form.Label>Profit / Minus (USD)</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                name="profit"
                value={form.profit}
                onChange={handleChange}
                required
              />
            </Form.Group>
          </Col>

          <Col md={2} className="d-flex align-items-end">
            <Button type="submit" className="w-100" color="#FDBA74">
              Tambah Data
            </Button>
          </Col>
        </Row>        
      </Form>
      </Card.Body>
    </Card>

      {/* Table data journal */}
    <h4 className="mt-5" style={{color: "#FAFAFA"}}>Data Trading</h4>
    <Card className="shadow-lg rounded mt-4">
  <Card.Body style={{ padding: 0 }}>
    <div style={{ maxHeight: "500px", overflowY: "auto" }}>
      <Table striped hover responsive className="mb-0" style={{ backgroundColor: "#6B7280" }}>
        <thead className="table-light" align="center">
          <tr>
            <th>Tanggal</th>
            <th>Modal</th>
            <th>Jenis Modal</th>
            <th>Pair</th>
            <th>Buy/Sell</th>
            <th>Lot</th>
            <th>Harga Entry</th>
            <th>Harga Stop Loss</th>
            <th>Harga Take Profit</th>
            <th>Analisa Before</th>
            <th>Analisa After</th>
            <th>Alasan Entry</th>
            <th>Win/Lose</th>
            <th>Profit (IDR)</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          {rowsWithBalance.map((j) => (
            <tr
              key={j.id}
              style={{
                cursor: "pointer",
                transition: "all 0.2s",
                backgroundColor: "#ffffff",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#f1f3f5")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#ffffff")
              }
            >
              <td align="center">{j.tanggalLabel}</td>
              <td align="center">
                {j.modal ? Number(j.modal).toLocaleString("id-ID") : "-"}
              </td>
              <td align="center">{j.modalType}</td>
              <td align="center">{j.pair}</td>
              <td
                align="center"
                style={{
                  color: j.side === "Buy" ? "green" : "red",
                  fontWeight: "bold",
                }}
              >
                {j.side}
              </td>
              <td align="center">{j.lot}</td>
              <td align="center">{Number(j.hargaEntry).toFixed(3)}</td>
              <td align="center">{Number(j.hargaStopLoss).toFixed(3)}</td>
              <td align="center">{Number(j.hargaTakeProfit).toFixed(3)}</td>
              <td align="center">
                {j.analisaBefore ? (
                  <Image
                    src={`http://localhost:5000/uploads/${j.analisaBefore}`}
                    thumbnail
                    style={{ maxHeight: "80px", borderRadius: "6px" }}
                    onClick={() => handleOpen(j.analisaBefore)}
                  />
                ) : (
                  "-"
                )}
              </td>
              <td align="center">
                {j.analisaAfter ? (
                  <Image
                    src={`http://localhost:5000/uploads/${j.analisaAfter}`}
                    thumbnail
                    style={{ maxHeight: "80px", borderRadius: "6px" }}
                    onClick={() => handleOpen(j.analisaAfter)}
                  />
                ) : (
                  "-"
                )}
              </td>
              <td align="center">{j.reason}</td>
              <td
                align="center"
                style={{
                  color: j.winLose === "Win" ? "green" : "red",
                  fontWeight: "bold",
                }}
              >
                {j.winLose}
              </td>
              <td align="center">
                {j.profitIDR.toLocaleString("id-ID", {
                  style: "currency",
                  currency: "IDR",
                })}
              </td>
              <td align="center">
                {j.balanceIDR.toLocaleString("id-ID", {
                  style: "currency",
                  currency: "IDR",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  </Card.Body>
</Card>

{/* Modal untuk gambar */}
<Modal show={show} onHide={handleClose} centered>
  <Modal.Body className="text-center">
    <Image src={imgSrc} fluid />
  </Modal.Body>
</Modal>


      {/* Dashboard */}
    <Row className="mt-5">
        <h4 className="mt-1" style={{color: "#FAFAFA"}}>Summary</h4>
        {/* <Col md={4}> */}
          <Card className="shadow-sm p-3 mb-5">
         <h5 className="mb-3">Win Rate</h5>
       <WinRatePerPair journal={journal} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "bold" }}>
              <span>Win</span>
              <div style={{ width: "20px", height: "20px", backgroundColor: "#4CAF50", borderRadius: "3px" }}></div>
              <span>Lose</span>
              <div style={{ width: "20px", height: "20px", backgroundColor: "#666666ff", borderRadius: "3px" }}></div>
          </div>
        </Card>
        {/* </Col> */}

        {/* <Col md={8}> */}
      <Card className="shadow-sm p-3" style={{ borderRadius: "12px", backgroundColor: "#ffffff" }}>
          <h5 style={{ textAlign: "center", marginBottom: "1.5rem", color: "#333", fontWeight: 600 }}>
            Equity berjalan (Profit kumulatif dalam IDR)
          </h5>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <LineChart
              width={650}
              height={350}
              data={equityData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
              <XAxis dataKey="tanggal" tick={{ fill: "#666", fontSize: 12 }} />
              <YAxis tick={{ fill: "#666", fontSize: 12 }} />
              <Tooltip
                formatter={(value, name, props) => {
                  const { payload } = props;
                  return payload.balanceLabel; // format IDR
                }}
                contentStyle={{
                  backgroundColor: "#fff",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                  padding: "8px",
                }}
              />
              <Legend wrapperStyle={{ paddingTop: "10px" }} />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#FDBA74"       // warna garis Peach/Apricot
                strokeWidth={3}
                dot={{ r: 4, fill: "#FFA500" }} // titik di setiap data
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </div>
        </Card>
      {/* </Col> */}
    </Row>
    </Container>
    </div>
    </div>
  );
}

export default App;
