[CmdletBinding()]
param(
    [ValidateSet('all', 'normal', 'pro', 'normal-renew', 'pro-renew')]
    [string[]]$Selection = @('all')
)

$ErrorActionPreference = 'Stop'

function Get-QuestionBank {
    param(
        [string]$Path,
        [string]$ConstName
    )

    $raw = Get-Content -Raw -Encoding UTF8 $Path
    $json = $raw -replace ('^\s*const\s+' + [regex]::Escape($ConstName) + '\s*=\s*'), ''
    $json = $json -replace ';\s*$', ''
    return $json | ConvertFrom-Json
}

function HtmlEscape {
    param([AllowNull()][string]$Text)
    return [System.Net.WebUtility]::HtmlEncode($Text)
}

function Render-BankPage {
    param(
        [string]$OutPath,
        [string]$Title,
        [string]$Description,
        [string]$Canonical,
        [object]$Bank
    )

    $items = @($Bank.data.PSObject.Properties | ForEach-Object { $_.Value } | Sort-Object number)
    $sections = @($items | Group-Object section | Sort-Object Name)
    $questionHtml = New-Object System.Text.StringBuilder

    foreach ($q in $items) {
        $sectionKey = "s$($q.section)"
        $sectionTitle = $Bank.sectionTitle.$sectionKey
        if (-not $sectionTitle) { $sectionTitle = "未分類" }
        [void]$questionHtml.AppendLine('                <article class="question-item">')
        [void]$questionHtml.AppendLine("                    <div class=""question-meta"">第 $($q.section) 章 - $(HtmlEscape $sectionTitle) / 題號 $($q.number)</div>")
        [void]$questionHtml.AppendLine("                    <p class=""question-title"">$(HtmlEscape $q.description)</p>")
        [void]$questionHtml.AppendLine('                    <ul class="option-list">')
        foreach ($opt in @('a', 'b', 'c', 'd')) {
            $value = $q.options.$opt
            if (-not $value) { continue }
            $label = $opt.ToUpper()
            $class = ''
            if ($opt -eq $q.answer) { $class = ' class="correct"' }
            [void]$questionHtml.AppendLine("                        <li$class>($label) $(HtmlEscape $value)</li>")
        }
        [void]$questionHtml.AppendLine('                    </ul>')
        [void]$questionHtml.AppendLine("                    <p class=""answer"">正確答案：$($q.answer.ToUpper())</p>")
        [void]$questionHtml.AppendLine('                </article>')
    }

    $sectionRows = New-Object System.Text.StringBuilder
    foreach ($section in $sections) {
        $sectionKey = "s$($section.Name)"
        $sectionTitle = $Bank.sectionTitle.$sectionKey
        if (-not $sectionTitle) { $sectionTitle = "未分類" }
        [void]$sectionRows.AppendLine("                <tr><td>第 $($section.Name) 章</td><td>$(HtmlEscape $sectionTitle)</td><td>$($section.Count) 題</td></tr>")
    }

    $generatedAt = Get-Date -Format 'yyyy-MM-dd'
    $versionStat = ''
    if ($Bank.version -and $Bank.version -ne 'latest') {
        $displayVersion = $Bank.version -replace '\.', '/'
        $versionStat = "                <div class=""bank-stat""><strong>$(HtmlEscape $displayVersion)</strong>官方題庫版本</div>"
    }
    $html = @"
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>$Title - 全國無人機測驗中心</title>
    <meta name="description" content="$Description">
    <link rel="canonical" href="$Canonical">
    <link rel="stylesheet" href="../assets/site.css">
</head>
<body>
    <header class="site-header">
        <div class="site-header-inner">
            <a class="brand" href="../index.html">全國無人機測驗中心</a>
            <nav class="site-nav">
                <a href="../guide/basic-drone-license.html">普通證指南</a>
                <a href="../guide/pro-drone-license.html">專業證指南</a>
                <a href="../sources.html">資料來源</a>
                <a href="../privacy.html">隱私權政策</a>
                <a href="../contact.html">聯絡我們</a>
            </nav>
        </div>
    </header>
    <main class="container">
        <article class="page-card">
            <p class="eyebrow">Static Question Bank</p>
            <h1>$Title</h1>
            <p class="lead">$Description</p>
            <p>本頁為靜態 HTML 題庫頁，方便使用者查閱，也讓搜尋引擎不依賴 JavaScript 即可讀取題目內容。題庫版本、正式答案與測驗規範仍請以交通部民用航空局官方公告為準。</p>

            <section class="bank-summary" aria-label="題庫摘要">
                <div class="bank-stat"><strong>$($items.Count)</strong>總題數</div>
                <div class="bank-stat"><strong>$($sections.Count)</strong>章節數</div>
$versionStat
                <div class="bank-stat"><strong>$generatedAt</strong>頁面產生日期</div>
            </section>

            <h2>章節分布</h2>
            <div class="table-wrap">
                <table>
                    <tr><th>章節</th><th>名稱</th><th>題數</th></tr>
$($sectionRows.ToString().TrimEnd())
                </table>
            </div>

            <h2>完整題目</h2>
            <div class="question-list">
$($questionHtml.ToString().TrimEnd())
            </div>
        </article>
    </main>
    <footer class="site-footer">
        <a href="../about.html">關於本站</a><a href="../sources.html">資料來源</a><a href="../privacy.html">隱私權政策</a><a href="../disclaimer.html">免責聲明</a><a href="../contact.html">聯絡我們</a>
        <div>© 2026 全國無人機測驗中心</div>
    </footer>
</body>
</html>
"@

    Set-Content -Encoding UTF8 -NoNewline -Path $OutPath -Value $html
}

$banks = @(
    @{
        Key = 'normal'
        Path = 'data_normal.js'
        ConstName = 'dataNormal'
        OutPath = 'questions/normal-bank.html'
        Title = '普通操作證靜態題庫'
        Description = '普通無人機操作證完整靜態題庫，包含章節、題號、選項與正確答案，正式版本請以民航局公告為準。'
        Canonical = 'https://uav-test.tw/questions/normal-bank.html'
    },
    @{
        Key = 'pro'
        Path = 'data_pro.js'
        ConstName = 'dataPro'
        OutPath = 'questions/pro-bank.html'
        Title = '專業操作證靜態題庫'
        Description = '專業無人機操作證完整靜態題庫，包含章節、題號、選項與正確答案，正式版本請以民航局公告為準。'
        Canonical = 'https://uav-test.tw/questions/pro-bank.html'
    },
    @{
        Key = 'normal-renew'
        Path = 'data_normal_renew.js'
        ConstName = 'dataNormalRenew'
        OutPath = 'questions/normal-renew-bank.html'
        Title = '屆期換證簡易靜態題庫'
        Description = '民航局 115 年 4 月 7 日版無人機操作證屆期換證簡易靜態題庫，共 120 題，包含選項與正確答案。'
        Canonical = 'https://uav-test.tw/questions/normal-renew-bank.html'
    },
    @{
        Key = 'pro-renew'
        Path = 'data_pro_renew.js'
        ConstName = 'dataProRenew'
        OutPath = 'questions/pro-renew-bank.html'
        Title = '屆期換證完整靜態題庫'
        Description = '民航局 115 年 4 月 7 日版無人機操作證屆期換證完整靜態題庫，共 324 題，包含選項與正確答案。'
        Canonical = 'https://uav-test.tw/questions/pro-renew-bank.html'
    }
)

$selectedBanks = if ($Selection -contains 'all') {
    $banks
} else {
    @($banks | Where-Object { $Selection -contains $_.Key })
}

foreach ($config in $selectedBanks) {
    $questionBank = Get-QuestionBank -Path $config.Path -ConstName $config.ConstName
    Render-BankPage -OutPath $config.OutPath -Title $config.Title -Description $config.Description -Canonical $config.Canonical -Bank $questionBank
}

Write-Output "Generated $($selectedBanks.Count) static question bank pages."
