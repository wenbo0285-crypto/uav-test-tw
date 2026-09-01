import fs from "node:fs";
import crypto from "node:crypto";
import vm from "node:vm";

const requiredFiles = [
  "index.html",
  "about.html",
  "friends.html",
  "sources.html",
  "privacy.html",
  "disclaimer.html",
  "contact.html",
  "robots.txt",
  "sitemap.xml",
  "assets/site.css",
  "assets/favicon.svg",
  "questions/normal.html",
  "questions/pro.html",
  "questions/renew.html",
  "questions/normal-bank.html",
  "questions/pro-bank.html",
  "questions/normal-renew-bank.html",
  "questions/pro-renew-bank.html",
];

const renewalVersion = "115.4.7";
const banks = [
  {
    file: "data_normal.js",
    constName: "dataNormal",
    expectedCount: 388,
    expectedHash: "e0120e070c80dea8758aa248c94e1c18ddca2d816a0d830966dde163c53e0353",
  },
  {
    file: "data_pro.js",
    constName: "dataPro",
    expectedCount: 588,
    expectedHash: "551a752a95c94c3720005655de0cbf8c15dcdd689f840af8945d4c876df56253",
  },
  {
    file: "data_normal_renew.js",
    constName: "dataNormalRenew",
    expectedCount: 120,
    expectedVersion: renewalVersion,
    expectedHash: "0fa4aa94e65e637655a875985acd36204d8f460d2aeb0355f2a00655ca323298",
    staticPage: "questions/normal-renew-bank.html",
  },
  {
    file: "data_pro_renew.js",
    constName: "dataProRenew",
    expectedCount: 324,
    expectedVersion: renewalVersion,
    expectedHash: "dd2444454797f2bc91721937281036c4f1ebcd0ac2945d3164007c0dd67c29f9",
    staticPage: "questions/pro-renew-bank.html",
  },
];

const optionKeys = ["a", "b", "c", "d"];
let failures = 0;

function fail(message) {
  console.error(message);
  failures += 1;
}

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    fail(`missing required file: ${file}`);
  }
}

function loadBank(file, constName) {
  const source = fs.readFileSync(file, "utf8");
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nthis.__bank = ${constName};`, sandbox, {
    filename: file,
    timeout: 5000,
  });
  return sandbox.__bank;
}

const loadedBanks = new Map();

for (const { file, constName, expectedCount, expectedVersion, expectedHash, staticPage } of banks) {
  const normalizedSource = fs.readFileSync(file, "utf8").replaceAll("\r\n", "\n");
  const sourceHash = crypto.createHash("sha256").update(normalizedSource).digest("hex");
  if (expectedHash && sourceHash !== expectedHash) {
    fail(`${file}: question-bank content changed; only update it after verifying a new official release`);
  }

  const bank = loadBank(file, constName);
  loadedBanks.set(constName, bank);
  if (!bank || typeof bank !== "object") {
    fail(`${file}: bank object not found`);
    continue;
  }

  if (!bank.version) {
    fail(`${file}: missing version`);
  }
  if (expectedVersion && bank.version !== expectedVersion) {
    fail(`${file}: expected version ${expectedVersion}, found ${bank.version}`);
  }

  if (!bank.sectionTitle || typeof bank.sectionTitle !== "object") {
    fail(`${file}: missing sectionTitle`);
  }

  const questions = bank.data ? Object.entries(bank.data) : [];
  if (questions.length === 0) {
    fail(`${file}: no questions found`);
    continue;
  }
  if (questions.length !== expectedCount) {
    fail(`${file}: expected ${expectedCount} questions, found ${questions.length}`);
  }

  const seenNumbers = new Set();
  for (const [id, question] of questions) {
    if (!Number.isInteger(question.number)) {
      fail(`${file}: ${id} missing numeric number`);
    }
    if (id !== `Q${question.number}`) {
      fail(`${file}: ${id} does not match question number ${question.number}`);
    }
    if (seenNumbers.has(question.number)) {
      fail(`${file}: duplicate question number ${question.number}`);
    }
    seenNumbers.add(question.number);
    if (!Number.isInteger(question.section)) {
      fail(`${file}: ${id} missing numeric section`);
    }
    if (!question.description || typeof question.description !== "string") {
      fail(`${file}: ${id} missing description`);
    } else if (question.description !== question.description.trim()) {
      fail(`${file}: ${id} description has leading or trailing whitespace`);
    }
    for (const key of optionKeys) {
      if (!question.options?.[key] || typeof question.options[key] !== "string") {
        fail(`${file}: ${id} missing option ${key}`);
      } else if (question.options[key] !== question.options[key].trim()) {
        fail(`${file}: ${id} option ${key} has leading or trailing whitespace`);
      }
    }
    if (!optionKeys.includes(question.answer)) {
      fail(`${file}: ${id} invalid answer ${question.answer}`);
    }
  }

  for (let number = 1; number <= expectedCount; number += 1) {
    if (!seenNumbers.has(number)) {
      fail(`${file}: missing contiguous question number ${number}`);
    }
  }

  if (expectedVersion && staticPage) {
    const html = fs.readFileSync(staticPage, "utf8");
    const displayVersion = expectedVersion.replaceAll(".", "/");
    if (!html.includes(`<strong>${displayVersion}</strong>官方題庫版本`)) {
      fail(`${staticPage}: missing question-bank version ${expectedVersion}`);
    }
  }

  console.log(`${file}: validated ${questions.length} questions`);
}

const officialRenewalCorrections = [
  ["dataNormalRenew", "Q103", "questions/normal-renew-bank.html"],
  ["dataProRenew", "Q280", "questions/pro-renew-bank.html"],
];

for (const [constName, id, staticPage] of officialRenewalCorrections) {
  const question = loadedBanks.get(constName)?.data?.[id];
  if (!question) {
    fail(`${constName}: missing regression-check question ${id}`);
    continue;
  }
  if (question.options.a !== "客機在機場停駐時。") {
    fail(`${constName}: ${id} option a does not match the 115.4.7 official wording`);
  }
  if (question.options.c !== "客機在機場爬升或下降過程中。" || question.answer !== "c") {
    fail(`${constName}: ${id} option c or answer does not match the 115.4.7 official source`);
  }

  const html = fs.readFileSync(staticPage, "utf8");
  for (const wording of ["客機在機場停駐時。", "客機在機場爬升或下降過程中。"]) {
    if (!html.includes(wording)) {
      fail(`${staticPage}: missing corrected wording for ${id}`);
    }
  }
}

const sitemap = fs.readFileSync("sitemap.xml", "utf8");
for (const page of [
  "https://uav-test.tw/",
  "https://uav-test.tw/about.html",
  "https://uav-test.tw/friends.html",
  "https://uav-test.tw/sources.html",
]) {
  if (!sitemap.includes(page)) {
    fail(`sitemap missing ${page}`);
  }
}

for (const file of ["index.html", "about.html", "friends.html", "sources.html", "privacy.html", "contact.html"]) {
  const html = fs.readFileSync(file, "utf8");
  if (!html.includes('rel="canonical"')) {
    fail(`${file}: missing canonical link`);
  }
  if (!html.includes("全國無人機測驗中心")) {
    fail(`${file}: missing site brand text`);
  }
}

const indexHtml = fs.readFileSync("index.html", "utf8");
if (!indexHtml.includes('rel="icon" href="./assets/favicon.svg"')) {
  fail("index.html: missing SVG favicon link");
}
if (!indexHtml.includes('<a href="./friends.html">友站連結</a>')) {
  fail("index.html: missing friend link in the blue header navigation");
}
if (indexHtml.includes("無人機操作證的有效期限為兩年")) {
  fail("index.html: contains the superseded two-year operation-certificate statement");
}
if (indexHtml.includes("提供給年滿 16 歲")) {
  fail("index.html: contains the superseded minimum age for a learning certificate");
}
for (const wording of [
  "申請者須年滿 14 歲",
  "操作證有效期限為三年",
  "113 年 12 月 1 日",
  "屆期前三個月內申請換證",
  "重新體格檢查及屆期換證測驗",
]) {
  if (!indexHtml.includes(wording)) {
    fail(`index.html: missing current Article 23 wording: ${wording}`);
  }
}

const sourcesHtml = fs.readFileSync("sources.html", "utf8");
for (const wording of ["遙控無人機管理規則", "操作證效期查核", "官方未發布新版前也不自行改寫"]) {
  if (!sourcesHtml.includes(wording)) {
    fail(`sources.html: missing required source-policy wording: ${wording}`);
  }
}

const navigableHtmlFiles = [
  ...requiredFiles.filter((file) => file.endsWith(".html")),
  ...fs.readdirSync("guide").filter((file) => file.endsWith(".html")).map((file) => `guide/${file}`),
];
for (const file of new Set(navigableHtmlFiles)) {
  const html = fs.readFileSync(file, "utf8");
  if (!html.includes('class="site-nav"')) {
    continue;
  }
  if (!/<nav class="site-nav"[^>]*>[\s\S]*?href="(?:\.\/|\.\.\/)friends\.html"[\s\S]*?<\/nav>/.test(html)) {
    fail(`${file}: missing friend link in the blue header navigation`);
  }
}

const friendsHtml = fs.readFileSync("friends.html", "utf8");
if (!friendsHtml.includes('href="https://nsn18201.webnode.tw/"')) {
  fail("friends.html: missing those-years-182 friend link");
}
if (!friendsHtml.includes('target="_blank" rel="noopener noreferrer external"')) {
  fail("friends.html: external friend link is missing safe new-tab attributes");
}

if (failures > 0) {
  console.error(`Validation failed with ${failures} issue(s)`);
  process.exit(1);
}

console.log("Static site validation passed");
