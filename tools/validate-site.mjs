import fs from "node:fs";
import vm from "node:vm";

const requiredFiles = [
  "index.html",
  "about.html",
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
  { file: "data_normal.js", constName: "dataNormal", expectedCount: 388 },
  { file: "data_pro.js", constName: "dataPro", expectedCount: 588 },
  {
    file: "data_normal_renew.js",
    constName: "dataNormalRenew",
    expectedCount: 120,
    expectedVersion: renewalVersion,
    staticPage: "questions/normal-renew-bank.html",
  },
  {
    file: "data_pro_renew.js",
    constName: "dataProRenew",
    expectedCount: 324,
    expectedVersion: renewalVersion,
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

for (const { file, constName, expectedCount, expectedVersion, staticPage } of banks) {
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
for (const page of ["https://uav-test.tw/", "https://uav-test.tw/about.html", "https://uav-test.tw/sources.html"]) {
  if (!sitemap.includes(page)) {
    fail(`sitemap missing ${page}`);
  }
}

for (const file of ["index.html", "about.html", "sources.html", "privacy.html", "contact.html"]) {
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

if (failures > 0) {
  console.error(`Validation failed with ${failures} issue(s)`);
  process.exit(1);
}

console.log("Static site validation passed");
