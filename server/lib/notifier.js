async function notifyTeam(event, payload) {
  const url = String(process.env.TEAM_WEBHOOK_URL || "").trim();

  if (!url) {
    return {
      sent: false,
      reason: "TEAM_WEBHOOK_URL is not configured"
    };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        source: "ApnaFinds",
        event,
        payload,
        sentAt: new Date().toISOString()
      }),
      signal: AbortSignal.timeout(12000)
    });

    return {
      sent: response.ok,
      status: response.status
    };
  } catch (error) {
    console.error("Team webhook failed:", error.message);

    return {
      sent: false,
      reason: error.message
    };
  }
}

module.exports = {
  notifyTeam
};
