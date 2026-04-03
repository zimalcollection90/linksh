
function testDetection(userAgent: string) {
  const isBotRaw = /(bot|crawler|spider|crawl|scraper|pingdom|headless|facebookexternalhit|facebot|googlebot|bingbot|yandexbot|baiduspider|twitterbot|linkedinbot|embedly|quora|pinterest|slackbot|vkShare|W3C_Validator)/i.test(userAgent || "");
  
  function detectBrowser(ua: string) {
    if (/chrome/i.test(ua) && !/edge|edg/i.test(ua)) return "Chrome";
    if (/firefox/i.test(ua)) return "Firefox";
    if (/safari/i.test(ua) && !/chrome/i.test(ua)) return "Safari";
    if (/edge|edg/i.test(ua)) return "Edge";
    if (/opera|opr/i.test(ua)) return "Opera";
    if (/facebookexternalhit|facebot/i.test(ua)) return "Facebook Scraper";
    if (/googlebot/i.test(ua)) return "Googlebot";
    if (/twitterbot/i.test(ua)) return "Twitterbot";
    if (/linkedinbot/i.test(ua)) return "LinkedInbot";
    return "Other";
  }

  return {
    userAgent,
    isBot: isBotRaw,
    browser: detectBrowser(userAgent)
  };
}

const testCases = [
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "Mozilla/5.0 (Linux; Android 13; SM-A127F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.119 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/553.0.0.56.58;IABMV/1;]",
  "Googlebot-Image/1.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
];

console.table(testCases.map(testDetection));
