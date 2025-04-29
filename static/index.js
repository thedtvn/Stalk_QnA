
let lastError = Date.now();

function load_QnA_screan() {
    const template = document.getElementById("message-template");
    const messageContainer = document.getElementById("container");
    messageContainer.innerHTML = "";
    for (let node of template.content.childNodes) {
        messageContainer.appendChild(node.cloneNode(true));
    }
    const btn = document.getElementById("ask");
    btn.addEventListener("click", send);
    const debug = document.getElementById("debug");
    function startHoldTimer() {
      holdTimer = setTimeout(async () => {
        const fingerprint = await getCanvasFingerprint();
        alert(fingerprint);
      }, 5000); // 5 seconds
    }

    function cancelHoldTimer() {
      clearTimeout(holdTimer);
    }

    debug.addEventListener("mousedown", startHoldTimer);
    debug.addEventListener("mouseup", cancelHoldTimer);
    debug.addEventListener("mouseleave", cancelHoldTimer);

    debug.addEventListener("touchstart", startHoldTimer);
    debug.addEventListener("touchend", cancelHoldTimer);
    debug.addEventListener("touchcancel", cancelHoldTimer);
}

function load_QnA_submited() {
    const template = document.getElementById("ok-template");
    const messageContainer = document.getElementById("container");
    messageContainer.innerHTML = "";
    for (let node of template.content.childNodes) {
        messageContainer.appendChild(node.cloneNode(true));
    }
    const btn = document.getElementById("ask");
    btn.addEventListener("click", load_QnA_screan);
}

function clearError() {
    const err = document.getElementById("err");
    if (!err) return;
    if (Date.now() - lastError > 3000) {
        err.style.display = "none";
    } else {
        setTimeout(clearError, 3000 - (Date.now() - lastError));
    }
}

function sendError(message) {
    const err = document.getElementById("err");
    if (!err) return;
    err.innerText = message;
    err.style.display = "block";
    lastError = Date.now();
    setTimeout(clearError, 3000);
}

async function getCanvasFingerprint() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  ctx.textBaseline = 'top';
  ctx.font = "16px 'Arial'";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f60";
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = "#069";
  ctx.fillText("C@nv@s-FP!", 2, 15);
  ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
  ctx.fillText("C@nv@s-FP!", 4, 17);

  ctx.beginPath();
  ctx.arc(50, 50, 25, 0, Math.PI * 2, true);
  ctx.stroke();

  const dataURL = canvas.toDataURL();

  const msgUint8 = new TextEncoder().encode(dataURL);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

function getSystemInfo() {
  const hints = [
    "architecture",
    "model",
    "platform",
    "platformVersion",
    "fullVersionList"
  ];

  if (
    navigator.userAgentData &&
    typeof navigator.userAgentData.getHighEntropyValues === "function"
  ) {
    return navigator.userAgentData.getHighEntropyValues(hints);
  }

  return Promise.resolve().then(() => {
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "Unknown";

    const architecture = /arm|aarch|arm64/i.test(ua)
      ? "ARM"
      : /x86|amd64|wow64|win64/i.test(ua)
      ? "x86"
      : "unknown";
    let model = "unknown";
    const iosMatch = ua.match(/\b(iPhone|iPad|iPod)\b/);
    if (iosMatch) {
      model = iosMatch[1];
    } else {
      const androidMatch = ua.match(/Android.*;\s*([^;]+)\s*Build/);
      model = androidMatch ? androidMatch[1].trim() : model;
    }

    let platformVersion = navigator.appVersion || "unknown"; 
    const iosVer = ua.match(/OS (\d+)_(\d+)_?(\d+)?/);
    if (iosVer) {
      platformVersion = iosVer.slice(1).filter(Boolean).join(".");
    } else {
      const androidVer = ua.match(/Android (\d+(?:\.\d+)+)/);
      if (androidVer) {
        platformVersion = androidVer[1];
      }
    }

    
    const fullVersionList = [];
    const regex = /([A-Za-z]+)\/(\d+(\.\d+)+)/g;
    let match;
    while ((match = regex.exec(ua)) !== null) {
      fullVersionList.push({ brand: match[1], version: match[2] });
    }

    return {
      architecture,
      model,
      platform,
      platformVersion,
      fullVersionList
    };
  });
}

async function send() {
    const btn = document.getElementById("ask");
    btn.disabled = true;
    const question = document.getElementById("question").value.trim();
    if (question == "") {
        sendError("Vui lòng nhập câu hỏi");
        btn.disabled = false;
        return;
    } else if (question.length > 100) {
        sendError("Câu hỏi quá dài, vui lòng nhập câu hỏi ngắn hơn 100 ký tự");
        document.getElementById("question").value = "";
        btn.disabled = false;
        return;
    } else if (question.length < 5) {
        sendError("Câu hỏi quá ngắn, vui lòng nhập câu hỏi dài hơn 5 ký tự");
        document.getElementById("question").value = "";
        btn.disabled = false;
        return;
    }

    let body = {
        t: await getCanvasFingerprint(),
        q: question,
        d: await getSystemInfo()
    };

    const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    if (response.status != 200) {
        sendError("Có lỗi xảy ra, vui lòng thử lại sau");
        btn.disabled = false;
        return;
    }
    btn.disabled = false;
    load_QnA_submited();
}

(async () => {
    load_QnA_screan();
})()