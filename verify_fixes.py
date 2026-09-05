"""
Verify each fixed rule has the correct pattern count and
that removed patterns are actually gone.
"""
import re

with open('H:/bots/f34rless-moderation/config.yml', encoding='utf-8') as f:
    content = f.read()

checks = [
    # (rule_name, pattern_to_find, should_exist, description)
    # Zalgo
    ("Zalgo", r'\[\\\\u0370-\\\\u03FF\]', False, "Greek letters range removed"),
    ("Zalgo", r'\[\\\\u0400-\\\\u04FF\]', False, "Cyrillic range removed"),
    ("Zalgo", r'\[\\\\u{1F100}', False, "Flag emoji range removed"),
    ("Zalgo", r'\[\\\\u{1D400}', False, "Math letters range removed"),
    ("Zalgo", r'\[\\\\u200B-\\\\u200F', True, "Zero-width chars kept"),
    # Severe Language
    ("Severe Language", r'        - cunt\r\n', False, "Plain 'cunt' removed"),
    ("Severe Language", r'        - slag\r\n', False, "Plain 'slag' removed"),
    ("Severe Language", r'\\bsl\[a@\]g\\b', False, "Regex slag removed"),
    ("Severe Language", r'\\bcunt\\b', True, "Word-bounded cunt kept"),
    ("Severe Language", r'\\bbastard\\b', True, "Word-bounded bastard kept"),
    # Self Harm
    ("Self Harm", r'\\blife\\s\+\(is\|s\)', False, "life is pointless removed"),
    ("Self Harm", r'\\bno\\s\+point\\s\+in\\s\+', False, "no point in living removed"),
    ("Self Harm", r'tired\|done\|over.*living\|life\|everything', False, "tired of everything removed"),
    ("Self Harm", r'\\bkys\\b\|k\\.y\\.s\\b', False, "kys standalone removed"),
    ("Self Harm", r'k\\.y\\.s\\b', True, "k.y.s spelled-out kept"),
    ("Self Harm", r'\\bself\\s\*delet', False, "self delete removed"),
    ("Self Harm", r'\(kms\|k\\.m\\.s', False, "kms standalone removed"),
    ("Self Harm", r'end\\s\+it\\s\+\(all\\s\+\)', False, "end it now removed"),
    # Scam Links
    ("Scam Links", r'bit\\.ly\|tinyurl', False, "URL shorteners removed"),
    ("Scam Links", r'qr\\.codes\|qrco', False, "QR code pattern removed"),
    ("Scam Links", r'\(free\|get\\s\+free\|claim\)\\s\+\(nitro', False, "Free nitro broad pattern removed"),
    ("Scam Links", r'\\bnitro\\s\*\(giveaway', True, "Nitro giveaway kept"),
    # Phishing  
    ("Phishing", r'\(click\|join\|visit\|open\|press\|verify\).*claim\|verify\|confirm', False, "Broad click/verify removed"),
    ("Phishing", r'\(claim\|collect\|redeem\).*prize\|reward\|gift', False, "Redeem code removed"),
    ("Phishing", r'\(you\\s\+\)\?\(won\|win\).*click\|link\|claim\|here\|join\)\\\\?\\b', False, "Won giveaway optional suffix removed"),
    ("Phishing", r'\(you\\s\+\)\?\(won\|win\).*click\|link\|claim\|here\|join\)\\b', True, "Won giveaway mandatory suffix kept"),
    # Doxxing
    ("Doxxing", r'\[0-9a-fA-F\]\{1,4\}:\)\{7\}', False, "IPv6 standalone removed"),
    ("Doxxing", r'25\[0-5\]\|2\[0-4\]\\\\d.*\)\{3\}', False, "IPv4 standalone removed"),
    ("Doxxing", r'sw\[a@\]t', True, "Swatting kept"),
    # NSFW
    ("NSFW", r'\\bhook\\s\*up\\b\r\n', False, "Hook up removed"),
    ("NSFW", r'\(ur\|u\|you\|ya\)\\s\+\(so\\s\+\|very', False, "u so sexy removed"),
    ("NSFW", r'slide\\s\+into\\s\+\(my\|your\|the\)', False, "Slide into DMs removed"),
    ("NSFW", r'\(snap\|insta\|kik\|tele\|discord\)\\s\*\(name\|tag', False, "Discord tag removed"),
    ("NSFW", r'h\[o0\*\]rn\[yi3\]', False, "Horny removed"),
    ("NSFW", r'\(your\|ur\)\\s\+\(body\|ass.*\)\\s\+\(is\|are\|looks', False, "Your body is broad removed"),
    ("NSFW", r'lowkey\|hella.*sexy\|hot\|fine\|fit', False, "Lowkey hot removed"),
    ("NSFW", r'\\bsend\\s\+nudes', True, "Send nudes kept"),
    # Executables
    ("Executables", r'\\b\[\\\\w\.-\]\+\\.\(exe\|bat', False, "Broad exe filename removed"),
    ("Executables", r'\\.\(exe\|bat', True, "URL-context exe kept"),
    # Homophobia
    ("Homophobia", r'\\btr\[a@\]p\\s\?sh\[i1\]t\\b', False, "Trap shit removed"),
    ("Homophobia", r'\\bh\[e3\]rm\[a@\]phr', False, "Hermaphrodite removed"),
    ("Homophobia", r'\\bg\[e3\]nd\[e3\]r\\s\?b\[e3\]nd', False, "Gender bender removed"),
    ("Homophobia", r'\\bcr\[o0\]ss\\s\?dr\[e3\]ss', False, "Crossdresser removed"),
    ("Homophobia", r'\\bt\[o0\]d\[g9\]\[e3\]rs', False, "Todger removed"),
    ("Homophobia", r'\\bm\[i1\]nc\[e3\]rs', False, "Mincer removed"),
    ("Homophobia", r'\\bb\[i1\]tch\\s\?b\[o0\]y\\b', False, "Bitch boy removed"),
    ("Homophobia", r'\\bfl\[a@\]m\[i1\]ng', True, "Flaming homo kept"),
    # Piracy
    ("Piracy", r'pirat\(?:e\|ing\|ed\|es\)\|crack\(?:s\|ing\|ed\)', False, "Broad pirate/crack removed"),
    ("Piracy", r'torrent\(?:s\|ing\|ed\)\?.*pirate.*bay', False, "Torrenting standalone removed"),
    ("Piracy", r'free\\s\*\(?:download\|version\|crack\|key', False, "Free download removed"),
    ("Piracy", r'pirate.*bay\|1337x', True, "Pirate bay kept"),
    ("Piracy", r'free\\s\*crack', True, "Free crack kept"),
    # Alt Account
    ("Alt Account Promotion", r"don\\\\'?t.*alt.*account", False, "Don't have alt removed"),
    ("Alt Account Promotion", r'backup\\s\*\(?:account\|acc\|acct\)', False, "Backup account removed"),
    ("Alt Account Promotion", r'smurf\\s\*\(?:account', True, "Smurf account kept"),
    ("Alt Account Promotion", r'ban\\s\*evad', True, "Ban evade kept"),
    # Staff Impersonation
    ("Staff Impersonation", r'\(can\|will\|will\\s\+now\|am\\s\+going', False, "I will ban you removed"),
    ("Staff Impersonation", r'can\|will.*remove\|delete\|ban\|kick\|mute.*you\|anyone', False, "I can ban removed"),
    ("Staff Impersonation", r'do\\s\+you\\s\+know\\s\+who', False, "Do you know who I am removed"),
    ("Staff Impersonation", r'have\\s\+\(?:the\\s\+\)\?(?:power\|authority', True, "Have authority kept"),
    # Advertising
    ("Advertising & DM Ads", r'join\|check\\s\+out\|visit.*server\|guild\|discord', False, "Join my server removed"),
    ("Advertising & DM Ads", r'check\\s\+your\\s\+dms', False, "Check your DMs removed"),
    ("Advertising & DM Ads", r'boost\\s\+\(?:my\|the\|this\)', False, "Boost server removed"),
    ("Advertising & DM Ads", r'anyone.*want\|wanna.*buy\|sell\|trade', False, "Anyone want to buy removed"),
    ("Advertising & DM Ads", r'link\\s\+in\\s\+\(?:bio', False, "Link in bio removed"),
    ("Advertising & DM Ads", r'free\\s\*\(?:nitro\|robux', True, "Free nitro kept"),
    # Bumping
    ("Bumping", r'please\\s\+\)\?bump\\b', False, "Please bump removed"),
    ("Bumping", r'disboard', True, "Disboard kept"),
]

passed = 0
failed = 0
for rule, pattern, should_exist, desc in checks:
    # Find rule section in content
    rule_start = content.find(f'    - name: {rule}')
    if rule_start == -1:
        rule_start = content.find(f"    - name: \"{rule}")
    
    if rule_start == -1:
        print(f"  WARN: Rule '{rule}' not found in file")
        continue
    
    # Find next rule or end
    next_rule = content.find('    - name:', rule_start + 10)
    if next_rule == -1:
        next_rule = len(content)
    
    rule_section = content[rule_start:next_rule]
    found = bool(re.search(pattern, rule_section))
    
    ok = (found == should_exist)
    status = "PASS" if ok else "FAIL"
    if ok:
        passed += 1
    else:
        failed += 1
        print(f"  {status}: [{rule}] {desc}")
        print(f"         pattern={pattern!r}, should_exist={should_exist}, found={found}")

print(f"\nVerification: {passed} passed, {failed} failed")
