# ============================================================
# F34RLESS Moderation - Regex False Positive Test Suite
# Tests patterns BEFORE and AFTER the audit fixes
# Run with: powershell -ExecutionPolicy Bypass -File test_regexes.ps1
# ============================================================

$script:pass = 0
$script:fail = 0
$script:results = [System.Collections.ArrayList]::new()

function Test-Pattern {
    param(
        [string]$RuleName,
        [string]$Pattern,
        [string]$TestString,
        [bool]$ShouldMatch,
        [string]$Note = ""
    )
    try {
        $matched = [regex]::IsMatch($TestString, $Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        $ok = ($matched -eq $ShouldMatch)
        if ($ok) { $script:pass++ } else { $script:fail++ }
        $status = if ($ok) { "PASS" } else { "FAIL" }
        $expectStr = if ($ShouldMatch) { "MATCH" } else { "NO-MATCH" }
        $gotStr    = if ($matched)     { "matched" } else { "no match" }
        $null = $script:results.Add([PSCustomObject]@{
            Status   = $status
            Rule     = $RuleName
            Expected = $expectStr
            Got      = $gotStr
            Input    = $TestString
            Note     = $Note
        })
    } catch {
        $script:fail++
        $null = $script:results.Add([PSCustomObject]@{
            Status   = "ERROR"
            Rule     = $RuleName
            Expected = if ($ShouldMatch) { "MATCH" } else { "NO-MATCH" }
            Got      = "EXCEPTION: $_"
            Input    = $TestString
            Note     = $Note
        })
    }
}

# ----------------------------------------------------------------
# 1. ZALGO - False positive patterns (OLD - these match things they shouldn't)
# ----------------------------------------------------------------
Write-Host "`n=== 1. ZALGO: False Positive Checks (OLD patterns are the problem) ===" -ForegroundColor Yellow

# Greek - catches legitimate Greek letters used in math/science
Test-Pattern "Zalgo/OLD Greek" "[\u0370-\u03FF]" "the value of β is 3.14" $true "FP: β in math context"
Test-Pattern "Zalgo/OLD Greek2" "[\u0370-\u03FF]" "use Δ to denote change" $true "FP: Δ in math context"
# Cyrillic - catches all Russian text
Test-Pattern "Zalgo/OLD Cyrillic" "[\u0400-\u04FF]" "Привет мир" $true "FP: Normal Russian text"
# Good patterns that should stay
Test-Pattern "Zalgo/KEEP ZeroWidth" "[\u200B-\u200F\u202A-\u202E\uFEFF]" "hello&#x200b;world" $true "KEEP: zero-width space = Zalgo"

# ----------------------------------------------------------------
# 2. SEVERE LANGUAGE - Scunthorpe problem and false positives
# ----------------------------------------------------------------
Write-Host "`n=== 2. SEVERE LANGUAGE: Scunthorpe & False Positive Checks ===" -ForegroundColor Yellow

# Without word boundaries (OLD)
Test-Pattern "SevereLang/OLD cunt" "cunt" "scunthorpe" $true "FP (Scunthorpe): old plain 'cunt' catches this"
Test-Pattern "SevereLang/OLD bastard" "bastard" "bastardization" $true "FP: 'bastardization' is a legitimate word"
Test-Pattern "SevereLang/OLD slag" "slag" "slag heap" $true "FP: metallurgy term"
Test-Pattern "SevereLang/OLD whore" "whore" "whoremaster" $true "FP: historical/literary term"

# With word boundaries (FIXED)
Test-Pattern "SevereLang/FIXED cunt boundary" "\bcunt\b" "scunthorpe" $false "FIXED: Scunthorpe NOT matched with word boundary"
Test-Pattern "SevereLang/FIXED cunt boundary" "\bcunt\b" "you cunt" $true "FIXED: direct insult still caught"
Test-Pattern "SevereLang/FIXED bastard boundary" "\bbastard\b" "bastardization" $false "FIXED: bastardization NOT matched"
Test-Pattern "SevereLang/FIXED bastard boundary" "\bbastard\b" "you bastard" $true "FIXED: direct insult still caught"
# Regex pattern that should stay (already has \b)
Test-Pattern "SevereLang/KEEP wh0re regex" "\bwh[o0]r[e3]s?\b" "whore" $true "KEEP: word-bounded regex version"
Test-Pattern "SevereLang/KEEP skank regex" "\bsk[a@]nk\b" "skank" $true "KEEP: word-bounded skank"

# ----------------------------------------------------------------
# 3. SELF HARM - False positives
# ----------------------------------------------------------------
Write-Host "`n=== 3. SELF HARM: False Positive Checks ===" -ForegroundColor Yellow

Test-Pattern "SelfHarm/OLD life not worth" "\blife\s+(is|s)\s+(not\s+worth|pointless|meaningless)\b" "life is pointless said the philosopher" $true "FP: philosophical discussion"
Test-Pattern "SelfHarm/OLD no point living" "\bno\s+point\s+in\s+(living|being\s+alive)\b" "no point in living for material things" $true "FP: spiritual/philosophical statement"
Test-Pattern "SelfHarm/OLD tired of everything" "(i'?m|im|i\s+am)\s+(?:so\s+)?(tired|done|over)\s+(?:of|with)\s+(living|life|everything|it\s+all)\b" "I'm so tired of everything today" $true "FP: common casual expression"
Test-Pattern "SelfHarm/OLD done with everything" "(i'?m|im|i\s+am)\s+(done|over|through)\s+(with\s+)?(life|living|everything|it\s+all)\b" "I'm done with everything after this exam" $true "FP: very common expression"
Test-Pattern "SelfHarm/OLD kys standalone" "\bkys\b" "kys lol" $true "FP: gaming slang (kill your score)"
Test-Pattern "SelfHarm/OLD kms standalone" "(kms|k\.m\.s|k\s+m\s+s)\s*(already|now|please|then)?\b" "kms after that match" $true "FP: gaming (kill my score)"
Test-Pattern "SelfHarm/OLD self delete" "\bself\s*delet(?:e|ing)?\b" "self-delete the file from the server" $true "FP: IT/tech term"
Test-Pattern "SelfHarm/OLD nobody wants you" "nob[o0]dy\s*(?:want[sd]?|love[sd]?|need[sd]?|care[sd]?\s*(?:about)?|miss(?:es)?)\s*you\b" "nobody wants you at this party lol" $true "FP: hyperbolic joke usage"
Test-Pattern "SelfHarm/OLD end it now" "end\s+it\s+(all\s+)?(now|already|please|tonight)" "just end it now (talking about a game)" $true "FP: gaming context"

# Good patterns that should stay
Test-Pattern "SelfHarm/KEEP explicit method" "(cut|slice|slash|slit)\s+(deep|straight|all)\s+(into|across|along)\s+(my|your|ur)\s+(wrist|arm|throat|neck)" "cut deep into my wrist" $true "KEEP: explicit self-harm method"
Test-Pattern "SelfHarm/KEEP how to suicide" "how\s+to\s+(commit\s+suicide|kill\s+(myself|yourself|urself)|end\s+(my|your|ur)\s+life)" "how to commit suicide" $true "KEEP: explicit search"
Test-Pattern "SelfHarm/KEEP kys spelled out" "k\.y\.s" "k.y.s" $true "KEEP: spelled-out form is unambiguous"
Test-Pattern "SelfHarm/KEEP off yourself" "off\s+yourself\b" "off yourself" $true "KEEP: clear harmful encouragement"

# ----------------------------------------------------------------
# 4. SCAM LINKS - False positives
# ----------------------------------------------------------------
Write-Host "`n=== 4. SCAM LINKS: False Positive Checks ===" -ForegroundColor Yellow

Test-Pattern "ScamLinks/OLD bit.ly" "https?://(bit\.ly|tinyurl\.com|is\.gd|cutt\.ly|ow\.ly|short\.io|rb\.gy|t\.ly|v\.gd|clck\.ru)/[^\s]+" "https://bit.ly/3xY9abZ" $true "FP: legitimate bit.ly link"
Test-Pattern "ScamLinks/OLD tinyurl" "https?://(bit\.ly|tinyurl\.com|is\.gd|cutt\.ly|ow\.ly|short\.io|rb\.gy|t\.ly|v\.gd|clck\.ru)/[^\s]+" "check this https://tinyurl.com/something" $true "FP: legitimate tinyurl"
Test-Pattern "ScamLinks/OLD qr codes" "https?://[^\s]*(qr\.codes|qrco\.de|me\.qr|qr\.page)[^\s]+" "https://qr.codes/myrestaurant" $true "FP: business QR code"
Test-Pattern "ScamLinks/OLD free nitro" "(free|get\s+free|claim)\s+(nitro|vbucks?|robux|steam\s*keys?|gift\s*cards?)\s*(for\s+(free|claiming))?\b" "Discord is giving get free nitro for Boost Month" $true "FP: legitimate Discord promo event discussion"

# Good patterns that should remain
Test-Pattern "ScamLinks/KEEP discord fake domain" "https?://[^\s]*(discord-?nitro|nitro-?claim|nitrogift|nitrodrop|nitro-\s*gift)[^\s]*" "https://discord-nitro.xyz/claim" $true "KEEP: obvious fake domain"
Test-Pattern "ScamLinks/KEEP grabify" "https?://(www\.)?(grabify\.)" "https://grabify.link/abc123" $true "KEEP: IP grabber link"
Test-Pattern "ScamLinks/KEEP nitro giveaway" "\bnitro\s*(giveaway|drop|claim|gift|give)\b" "nitro giveaway click here" $true "KEEP: nitro giveaway scam"

# ----------------------------------------------------------------
# 5. PHISHING - False positives
# ----------------------------------------------------------------
Write-Host "`n=== 5. PHISHING: False Positive Checks ===" -ForegroundColor Yellow

Test-Pattern "Phishing/OLD click verify" "(click|join|visit|open|press|verify)\s+(here|this|the|that)?\s*(link|site|url|page|server|button)?\s*(to|and|for)?\s*(claim|verify|confirm|unlock|get|receive)\b" "click here to verify your email address" $true "FP: legitimate email verification message"
Test-Pattern "Phishing/OLD click verify 2" "(click|join|visit|open|press|verify)\s+(here|this|the|that)?\s*(link|site|url|page|server|button)?\s*(to|and|for)?\s*(claim|verify|confirm|unlock|get|receive)\b" "visit the page to get more info" $true "FP: innocent redirect"
Test-Pattern "Phishing/OLD redeem code" "(claim|collect|redeem)\s+(your|the|a)\s+(prize|reward|gift|nitro|item|skin|code)\b" "redeem your code here" $true "FP: normal game code sharing"
Test-Pattern "Phishing/OLD won giveaway noclick" "(you\s+)?(won|win)\s+(a|the|first)\s+(prize|reward|giveaway)\s*(click|link|claim|here|join)?\b" "you won the first giveaway!" $true "FP: legitimate giveaway announcement"

# Good patterns that should stay
Test-Pattern "Phishing/KEEP compromised account" "(your\s+)?(discord\s+)?(account|token|password)\s+(has\s+been|was|is|got|get)\s+(compromised|hacked|stolen|suspended|banned|flagged|deleted)" "your account has been compromised click here" $true "KEEP: account compromise claim"
Test-Pattern "Phishing/KEEP deletion threat" "(?!.*inactiv)(account|profile|server|identity)\s+(will\s+be|is\s+being|getting|about\s+to\s+be)\s+(deleted|banned|suspended|terminated)\s+(in|within|after)\s+(\d+\s*)?(hours?|days?|minutes?|24h|48h)\b" "your account will be deleted in 24h" $true "KEEP: fake deletion threat"
Test-Pattern "Phishing/KEEP verify avoid deletion" "(verify|confirm|validate)\s+your\s+(account|identity|server)\s+(to\s+)?(avoid|prevent|stop)\s+(deletion|suspension|termination|ban)\b" "verify your account to avoid deletion" $true "KEEP: phishing template"

# ----------------------------------------------------------------
# 6. DOXXING - False positives
# ----------------------------------------------------------------
Write-Host "`n=== 6. DOXXING: False Positive Checks ===" -ForegroundColor Yellow

Test-Pattern "Doxxing/OLD IPv4 technical" "\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[2-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[2-9]\d|\d)\b" "my server IP is 192.168.1.1" $true "FP: local IP in technical discussion"
Test-Pattern "Doxxing/OLD IPv4 technical2" "\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[2-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[2-9]\d|\d)\b" "connect to 10.0.0.1 for LAN" $true "FP: LAN IP in tech help"
Test-Pattern "Doxxing/OLD IPv6 programming" "\b([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b" "2001:0db8:85a3:0000:0000:8a2e:0370:7334" $true "FP: IPv6 in programming discussion"

# Good contextual patterns that should stay
Test-Pattern "Doxxing/KEEP your ip is" "(your|ur|his|her|their)\s+(ip|address|location|position)\s*(?:is\s*[:=]?|[:=])\s*[\d\w]" "your IP is 1.2.3.4 haha" $true "KEEP: threatening IP reveal"
Test-Pattern "Doxxing/KEEP pull ip" "(pull|grab|trace|find|hunt)\s+(ur|your|their|his|her)\s+(ip|location|address|info)" "I'll pull your IP" $true "KEEP: IP threat"
Test-Pattern "Doxxing/KEEP swatting" "\bsw[a@]t{1,2}(ing|ted|ter)\b" "I'll get you swatted" $true "KEEP: swatting threat"
Test-Pattern "Doxxing/KEEP dropping dox" "\b(dropping|leaking|posting|going\s+to|will|gonna|gon)\s+(dox|doxx)\b|\bdox{1,2}(?:ed|ing|er|ers)\b" "I'm going to dox you" $true "KEEP: explicit dox threat"

# ----------------------------------------------------------------
# 7. NSFW - False positives
# ----------------------------------------------------------------
Write-Host "`n=== 7. NSFW: False Positive Checks ===" -ForegroundColor Yellow

Test-Pattern "NSFW/OLD hook up" "\bhook\s*up\b" "hook up the HDMI cable" $true "FP: technical usage"
Test-Pattern "NSFW/OLD hook up 2" "\bhook\s*up\b" "can you hook up the controller?" $true "FP: innocent usage"
Test-Pattern "NSFW/OLD u so sexy" "\b(ur|u|you|ya)\s+(so\s+|very\s+|really\s+)?(sexy|hot|fine|cute|gorgeous|pretty)\b" "you are so cute!" $true "FP: innocent compliment"
Test-Pattern "NSFW/OLD ur so pretty" "\b(ur|u|you|ya)\s+(so\s+|very\s+|really\s+)?(sexy|hot|fine|cute|gorgeous|pretty)\b" "ur so pretty" $true "FP: innocent compliment"
Test-Pattern "NSFW/OLD you're gorgeous" "(you\s+are|ur|u\s+r|you'?re)\s+(so\s+|very\s+|really\s+)?(gorgeous|sexy|hot|cute|fine)\b" "you're so cute!" $true "FP: innocent compliment"
Test-Pattern "NSFW/OLD slide into dms" "slide\s+into\s+(my|your|the)\s+dms?\b" "slide into my DMs lol" $true "FP: common meme phrase"
Test-Pattern "NSFW/OLD discord tag" "(snap|insta|kik|tele|discord)\s*(name|tag|handle|user|id)\s*[?:]" "what's your discord tag?" $true "FP: completely normal question"
Test-Pattern "NSFW/OLD horny" "\b(h[o0*]rn[yi3]|h[o0]rni)\b" "I'm so horny for pizza rn" $true "FP: casual/meme usage"
Test-Pattern "NSFW/OLD your legs are" "\b(your|ur)\s+(body|ass|tits|dick|pussy|boobs|cock|legs)\s+(is|are|looks?|look|be)\b" "your legs are sore after the run?" $true "FP: innocent body reference"
Test-Pattern "NSFW/OLD lowkey cute" "\b((?:you(?:'?re|r)|u(?:'?re)?|ya)\s+|(?:you|u)\s+(?:are|r)\s+)(?:so|really|lowkey|hella|very|so\s+damn|f[u*]ck[i1]ng)\s*(?:f[u*]ck[i1]ng\s+)?(sexy|hot|fine|fit|cute|gorgeous|pretty|beautiful)\b" "you're lowkey cute ngl" $true "FP: casual compliment"

# Good patterns that should stay
Test-Pattern "NSFW/KEEP send nudes" "\b(send|dm|pm|share|snap|slide)\s+(me\s+)?(your\s+)?(nudes?|lewds?|feet\s*pics?|body|ass|tits|dick|pussy|boobs|cock|nude)\b" "send me nudes" $true "KEEP: explicit request"
Test-Pattern "NSFW/KEEP porn" "\b(p+[o0*]+r+n+[o0]*|ph[o0]*rn[o0]*|pr[o0]+n|p[o0]*rn[o0]*gr[a@]+ph[yi]*)\b" "watching porn" $true "KEEP: explicit content"
Test-Pattern "NSFW/KEEP goon" "\bg[o0*][o0*]n(?:ing|ed|er[s]?|ette|s|session|\s+(?:session|cave|mode|squad|club|brain))?\b" "goon session tonight" $true "KEEP: explicit slang"
Test-Pattern "NSFW/KEEP wanna hookup" "\b(wanna|want\s+to|lets?)\s+hook\s*up\b" "wanna hook up?" $true "KEEP: intent-clear hook up"

# ----------------------------------------------------------------
# 8. EXECUTABLES - False positive
# ----------------------------------------------------------------
Write-Host "`n=== 8. EXECUTABLES: False Positive Checks ===" -ForegroundColor Yellow

Test-Pattern "Exec/OLD broad pattern" "\b[\w.-]+\.(exe|bat|cmd|scr|vbs|dll|sys|sh|bash)\b" "I ran setup.exe to install it" $true "FP: mentioning extension in conversation"
Test-Pattern "Exec/OLD broad pattern 2" "\b[\w.-]+\.(exe|bat|cmd|scr|vbs|dll|sys|sh|bash)\b" "script.sh won't run on windows" $true "FP: tech discussion"
Test-Pattern "Exec/OLD broad pattern 3" "\b[\w.-]+\.(exe|bat|cmd|scr|vbs|dll|sys|sh|bash)\b" "app.dmg is the mac installer" $true "FP: legitimate software discussion"

# Good contextual pattern should stay (requires URL/path context)
Test-Pattern "Exec/KEEP URL pattern" "\.(exe|bat|cmd|scr|vbs|dll|sys)(?:\?.*)?(?:$|\s|/|`"|')" "https://evil.com/virus.exe here" $true "KEEP: URL with exe = suspicious"

# ----------------------------------------------------------------
# 9. HOMOPHOBIA - False positives
# ----------------------------------------------------------------
Write-Host "`n=== 9. HOMOPHOBIA: False Positive Checks ===" -ForegroundColor Yellow

Test-Pattern "Homophobia/OLD trap shit" "\btr[a@]p\s?sh[i1]t\b" "I love trap shit as a music genre" $true "FP: music genre reference"
Test-Pattern "Homophobia/OLD hermaphrodite" "\bh[e3]rm[a@]phr[o0]d[i1]t[e3]s?\b" "hermaphrodite organisms in biology class" $true "FP: biology/medical term"
Test-Pattern "Homophobia/OLD gender bender" "\bg[e3]nd[e3]r\s?b[e3]nd[e3]rs?\b" "gender bender anime is popular" $true "FP: anime trope"
Test-Pattern "Homophobia/OLD crossdresser" "\bcr[o0]ss\s?dr[e3]ss[e3]rs?\b" "crossdresser is a neutral descriptor" $true "FP: neutral descriptor"
Test-Pattern "Homophobia/OLD todger" "\bt[o0]d[g9][e3]rs?\b" "watch out for the todger" $true "FP: humorous British slang (not homophobic)"
Test-Pattern "Homophobia/OLD pansy" "\bp[a@]nsy\s?b[o0]y\b|\b(?:you|ur|u|he'?s|she'?s|th[a@]t|little|silly|stupid|what\s+a)\s+p[a@]ns(?:[y1i](?:es)?)\b" "what a pansy" $true "FP: could refer to the flower"
Test-Pattern "Homophobia/OLD mincer" "\bm[i1]nc[e3]rs?\b" "I used the mincer to grind meat" $true "FP: kitchen appliance"
Test-Pattern "Homophobia/OLD bitch boy" "\bb[i1]tch\s?b[o0]y\b" "stop being a bitch boy about it" $true "FP: general insult not specific to homophobia"

# Good patterns that should stay
Test-Pattern "Homophobia/KEEP troon" "\btr[o0][o0]n\b" "you're a troon" $true "KEEP: slur"
Test-Pattern "Homophobia/KEEP faggot" "\bf[a@4]gg?(?:[o0]t|s)?s?\b" "you faggot" $true "KEEP: slur"
Test-Pattern "Homophobia/KEEP 41 percent" "\b41\s?p[e3]rc[e3]nt\b" "41 percent lmao" $true "KEEP: hateful reference"
Test-Pattern "Homophobia/KEEP flaming homo" "\bfl[a@]m[i1]ng\s?(?:h[o0]m[o0]|f[a@]g|qu[e3][e3]r)\b" "flaming homo" $true "KEEP: homophobic compound term"

# ----------------------------------------------------------------
# 10. PIRACY - False positives
# ----------------------------------------------------------------
Write-Host "`n=== 10. PIRACY: False Positive Checks ===" -ForegroundColor Yellow

Test-Pattern "Piracy/OLD broad pirate" "\b(pirat(?:e|ing|ed|es)|crack(?:s|ing|ed)?|keygen(?:s)?|warez)\b" "pirates of the caribbean is great" $true "FP: movie title"
Test-Pattern "Piracy/OLD broad crack" "\b(pirat(?:e|ing|ed|es)|crack(?:s|ing|ed)?|keygen(?:s)?|warez)\b" "cracking a joke" $true "FP: idiom"
Test-Pattern "Piracy/OLD broad crack 2" "\b(pirat(?:e|ing|ed|es)|crack(?:s|ing|ed)?|keygen(?:s)?|warez)\b" "cracking knuckles" $true "FP: common phrase"
Test-Pattern "Piracy/OLD torrenting legal" "\b(torrent(?:s|ing|ed)?|magnet:\s*link|pirate\s*bay|1337x|rutracker|kickass)\b" "I'm torrenting Ubuntu ISO" $true "FP: legal torrent"
Test-Pattern "Piracy/OLD free download" "\b(free\s*(?:download|version|crack|key|license|activation))\b" "free download of the trial version" $true "FP: legitimate free software"
Test-Pattern "Piracy/OLD free version" "\b(free\s*(?:download|version|crack|key|license|activation))\b" "get the free version here" $true "FP: legitimate free tier"

# Good patterns that should stay
Test-Pattern "Piracy/KEEP how to pirate" "\b(how\s+to\s+(pirate|crack|get\s+free)|where\s+to\s+(pirate|download\s+free))\b" "how to pirate photoshop" $true "KEEP: explicit piracy intent"
Test-Pattern "Piracy/KEEP bypass activation" "\b(bypass\s*(?:activation|license|payment|trial))\b" "bypass activation key" $true "KEEP: explicit crack intent"
Test-Pattern "Piracy/KEEP pirate bay site" "\b(torrent(?:s|ing|ed)?|magnet:\s*link|pirate\s*bay|1337x|rutracker|kickass)\b" "get it from pirate bay" $true "KEEP: specific piracy site"
Test-Pattern "Piracy/KEEP nulled" "\b(nulled|nulled\s*(?:script|plugin|theme|addon))\b" "found a nulled plugin" $true "KEEP: nulled software"

# ----------------------------------------------------------------
# 11. ALT ACCOUNT - False positives
# ----------------------------------------------------------------
Write-Host "`n=== 11. ALT ACCOUNT: False Positive Checks ===" -ForegroundColor Yellow

Test-Pattern "AltAcc/OLD dont have alt" "\b(don\'?t\s+(?:have|got)\s+(?:an?\s+)?alt\s+(?:account|for\s+this))\b" "I don't have an alt account for this" $true "FP: innocent denial"
Test-Pattern "AltAcc/OLD backup account" "\b(backup\s*(?:account|acc|acct))\b" "backup my account settings" $true "FP: normal backup action"
Test-Pattern "AltAcc/OLD backup account 2" "\b(backup\s*(?:account|acc|acct))\b" "does discord have a backup account feature?" $true "FP: innocent question"

# Good patterns that should stay
Test-Pattern "AltAcc/KEEP ban evade" "\b(ban\s*evad(?:e|ing|ed)|evad(?:e|ing|ed)\s+(?:the\s+)?ban)\b" "ban evading with alt" $true "KEEP: ban evasion"
Test-Pattern "AltAcc/KEEP im back on alt" "\b(i'?m\s+(?:back|here|online)\s+(?:on|with)\s+(?:my\s+)?(?:alt|backup|smurf|throwaway))\b" "I'm back on my alt" $true "KEEP: explicit alt usage"
Test-Pattern "AltAcc/KEEP smurf account" "\b(smurf\s*(?:account|acc|acct))\b" "using a smurf account" $true "KEEP: smurf account"

# ----------------------------------------------------------------
# 12. STAFF IMPERSONATION - False positives
# ----------------------------------------------------------------
Write-Host "`n=== 12. STAFF IMPERSONATION: False Positive Checks ===" -ForegroundColor Yellow

Test-Pattern "StaffImp/OLD i will ban you" "\b(?:i\s+)?(?:can|will|will\s+now|am\s+going\s+to)\s+(?:mute|ban|kick|warn|timeout|punish|unmute|unban)\s+(?:you|them|him|her|u|ur)\b" "I will ban you lmao (joke)" $true "FP: joke threat between friends"
Test-Pattern "StaffImp/OLD i can ban" "\b(?:i\s+)?(?:can|will)\s+(?:remove|delete|ban|kick|mute)\s+(?:you|anyone|everyone|them)\b" "I can ban anyone from my game server" $true "FP: game context"
Test-Pattern "StaffImp/OLD do you know who i am" "\b(?:do\s+you\s+know\s+who\s+i\s+am|i\s+know\s+(?:the\s+)?(?:owner|admin|staff|mod))\b" "do you know who I am? lol" $true "FP: common meme"
Test-Pattern "StaffImp/OLD i know the admin" "\b(?:do\s+you\s+know\s+who\s+i\s+am|i\s+know\s+(?:the\s+)?(?:owner|admin|staff|mod))\b" "I know the admin personally, he's my friend" $true "FP: factual statement"

# Good patterns that should stay
Test-Pattern "StaffImp/KEEP i am staff" "\b(i\s+(?:am|'?m)\s+(?:a\s+|the\s+|an\s+)?)\s*(?:staff|mod(?:erator)?|admin(?:istrator)?|owner|helper|trial\s*mod)\b" "I am the moderator here" $true "KEEP: impersonation claim"
Test-Pattern "StaffImp/KEEP have authority" "\b(?:i\s+)?(?:have\s+(?:the\s+)?(?:power|authority|permission|right)\s+to)\s+(?:mute|ban|kick|warn|timeout|punish)\b" "I have the authority to ban you" $true "KEEP: authority claim"

# ----------------------------------------------------------------
# 13. ADVERTISING - False positives
# ----------------------------------------------------------------
Write-Host "`n=== 13. ADVERTISING: False Positive Checks ===" -ForegroundColor Yellow

Test-Pattern "Advert/OLD check your dms" "\b(?:i'?ll?\s+dm\s+you|check\s+your\s+dms?|dm\s+sent|slid(?:ing)?\s+(?:into|in)\s+your\s+dm)\b" "check your DMs I sent the info" $true "FP: staff commonly say this"
Test-Pattern "Advert/OLD link in bio" "\b(?:link\s+in\s+(?:bio|description|chat|comments))\b" "link in bio for the doc" $true "FP: common informational usage"
Test-Pattern "Advert/OLD boost server" "\b(?:boost\s+(?:my|the|this)\s+(?:server|guild|discord))\b" "please boost this server for perks" $true "FP: normal Discord feature"
Test-Pattern "Advert/OLD anyone want to buy" "\b(?:anyone\s+(?:want|wanna|interested\s+in)\s+(?:to\s+)?(?:buy|sell|trade|get))\b" "anyone want to trade pokemon cards?" $true "FP: innocent marketplace request"
Test-Pattern "Advert/OLD join my server" "\b(?:join|check\s+out|visit|subscribe\s+to|follow)\s+(?:my|our|this|the)\s+(?:server|guild|discord|channel|stream|youtube|twitch|tiktok|instagram|twitter|ig)\b" "join our discord channel for help" $true "FP: staff/support sharing links"

# Good patterns that should stay
Test-Pattern "Advert/KEEP free nitro" "\b(?:free\s*(?:nitro|robux|vbucks|gift|money|crypto|coins))\b" "free nitro click here!" $true "KEEP: free currency scam"
Test-Pattern "Advert/KEEP giveaway join" "\b(?:giveaway|give\s+away|prize|winner|congrat(?:s|ulations))\s+(?:in|at|on|join|click|check|enter)\b" "giveaway join now!" $true "KEEP: giveaway spam"
Test-Pattern "Advert/KEEP use my code" "\b(?:use\s+my\s+(?:code|ref|referral|affiliate|coupon))\b" "use my referral code" $true "KEEP: referral spam"

# ----------------------------------------------------------------
# 14. BUMPING - False positives
# ----------------------------------------------------------------
Write-Host "`n=== 14. BUMPING: False Positive Checks ===" -ForegroundColor Yellow

Test-Pattern "Bumping/OLD plain bump baby" "\b(?:please\s+)?bump\b" "baby bump photos are cute" $true "FP: 'baby bump'"
Test-Pattern "Bumping/OLD plain bump speed" "\b(?:please\s+)?bump\b" "there was a speed bump ahead" $true "FP: 'speed bump'"
Test-Pattern "Bumping/OLD plain bump road" "\b(?:please\s+)?bump\b" "we hit a bump in the road" $true "FP: common idiom"
Test-Pattern "Bumping/OLD plain bump please" "\b(?:please\s+)?bump\b" "please bump my post" $true "NOTE: this matches intended target but also innocents"

# Good patterns that should stay (server/context-specific)
Test-Pattern "Bumping/KEEP disboard bump" "\b(?:bump(?:ing|ed|s)?|disboard|bump\s+(?:this|the|my|our|a)\s+(?:server|guild|discord))\b" "bump this server on disboard" $true "KEEP: server bumping"
Test-Pattern "Bumping/KEEP bump command" "\b(?:bump\s+(?:command|me|this|us|it|server|guild))\b" "use the bump command" $true "KEEP: bump command reference"

# ================================================================
# SUMMARY
# ================================================================
Write-Host "`n`n========================================" -ForegroundColor Cyan
Write-Host "      REGEX FALSE POSITIVE REPORT       " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$failed = $script:results | Where-Object { $_.Status -eq "FAIL" }
$passed = $script:results | Where-Object { $_.Status -eq "PASS" }
$errors = $script:results | Where-Object { $_.Status -eq "ERROR" }

Write-Host "Total tests : $($script:results.Count)" -ForegroundColor White
Write-Host "Passed      : $($passed.Count)" -ForegroundColor Green
Write-Host "Failed      : $($failed.Count)" -ForegroundColor Red
Write-Host "Errors      : $($errors.Count)" -ForegroundColor Yellow

if ($failed.Count -gt 0) {
    Write-Host "`n--- FAILED TESTS (unexpected results) ---" -ForegroundColor Red
    $failed | ForEach-Object {
        Write-Host "  [$($_.Rule)]" -ForegroundColor Red
        Write-Host "    Expected : $($_.Expected) | Got: $($_.Got)" -ForegroundColor DarkRed
        Write-Host "    Input    : '$($_.Input)'" -ForegroundColor DarkRed
        Write-Host "    Note     : $($_.Note)" -ForegroundColor DarkRed
    }
}

if ($errors.Count -gt 0) {
    Write-Host "`n--- ERROR TESTS (invalid regex) ---" -ForegroundColor Yellow
    $errors | ForEach-Object {
        Write-Host "  [$($_.Rule)] $($_.Got)" -ForegroundColor Yellow
        Write-Host "    Input : '$($_.Input)'" -ForegroundColor DarkYellow
    }
}

Write-Host "`n--- CONFIRMED FALSE POSITIVES (OLD rules - pre-fix) ---" -ForegroundColor Magenta
$script:results | Where-Object { $_.Note -like "FP:*" -and $_.Status -eq "PASS" } | ForEach-Object {
    Write-Host "  [$($_.Rule)] $($_.Note)" -ForegroundColor Magenta
    Write-Host "    Input: '$($_.Input)'" -ForegroundColor DarkMagenta
}

$goodKept = $script:results | Where-Object { $_.Note -like "KEEP:*" -and $_.Status -eq "PASS" }
Write-Host "`n--- GOOD PATTERNS CONFIRMED WORKING ($($goodKept.Count) patterns still catch real violations) ---" -ForegroundColor Green
$goodKept | ForEach-Object {
    Write-Host "  [$($_.Rule)] $($_.Note)" -ForegroundColor DarkGreen
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Test complete. Review FAIL items above." -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
