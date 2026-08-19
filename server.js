require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const MONCASH_API_URL =
  process.env.MONCASH_API_URL ||
  "https://sandbox.moncashbutton.digicelgroup.com/Api";

const MONCASH_GATEWAY_URL =
  process.env.MONCASH_GATEWAY_URL ||
  "https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware";

async function getAccessToken() {
  const clientId = process.env.MONCASH_CLIENT_ID;
  const clientSecret = process.env.MONCASH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("MONCASH_CLIENT_ID or MONCASH_CLIENT_SECRET is missing");
  }

  const response = await axios.post(
    `${MONCASH_API_URL}/oauth/token`,
    "scope=read,write&grant_type=client_credentials",
    {
      auth: {
        username: clientId,
        password: clientSecret
      },
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );

  return response.data.access_token;
}

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "MonCash backend is running"
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "ok"
  });
});

app.post("/api/moncash/payment", async (req, res) => {
  try {
    const { amount, orderId } = req.body;

    if (!amount || !orderId) {
      return res.status(400).json({
        success: false,
        error: "amount and orderId are required"
      });
    }

    const token = await getAccessToken();

    const response = await axios.post(
      `${MONCASH_API_URL}/v1/CreatePayment`,
      {
        amount: Number(amount),
        orderId: String(orderId)
      },
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    const paymentToken = response.data?.payment_token?.token;

    if (!paymentToken) {
      return res.status(502).json({
        success: false,
        error: "MonCash did not return a payment token"
      });
    }

    const redirectUrl =
      `${MONCASH_GATEWAY_URL}/Payment/Redirect?token=` +
      encodeURIComponent(paymentToken);

    return res.json({
      success: true,
      payment_token: paymentToken,
      redirect_url: redirectUrl,
      moncash_response: response.data
    });

  } catch (error) {
    console.error(
      "MonCash error:",
      error.response?.data || error.message
    );

    return res.status(error.response?.status || 500).json({
      success: false,
      error: "Payment creation failed",
      details: error.response?.data || error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`MonCash backend running on port ${PORT}`);
});
