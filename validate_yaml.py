"""
Validate the config using ruamel.yaml (more permissive) or by checking
only the regex_engine section specifically.
"""
import re

with open('H:/bots/f34rless-moderation/config.yml', encoding='utf-8') as f:
    content = f.read()

# Extract just the regex_engine block for validation
# Count rules by searching for 'name:' entries under regex_engine
rule_names = re.findall(r'^\s+- name: (.+)$', content, re.MULTILINE)

# Find regex_engine section
re_start = content.find('regex_engine:')
re_section = content[re_start:re_start+200000]

# Count patterns
all_patterns = re.findall(r'^\s+- (?!name:|type:|flags:|scope:|enabled:|immune|action|format:|content:|title:|description:|footer:|accent|delete|reason:|dm_first:|luhn:|pattern:)(.+)$', re_section, re.MULTILINE)

print(f"Total rule names found in file: {len(rule_names)}")
print(f"All rules: {rule_names}")

# Check for any truly problematic YAML issues in the patterns section
# Look for unquoted special chars that would break YAML
problems = []
lines = content.split('\n')
in_patterns = False
for i, line in enumerate(lines, 1):
    stripped = line.strip()
    if stripped.startswith('patterns:'):
        in_patterns = True
    elif stripped.startswith('flags:') or stripped.startswith('scope:'):
        in_patterns = False
    
    if in_patterns and stripped.startswith('- ') and not stripped.startswith('- name:') and not stripped.startswith('- pattern:') and not stripped.startswith('- type:'):
        # Check if the value starts with problematic YAML chars when not quoted
        val = stripped[2:].strip()
        if val and not val.startswith('"') and not val.startswith("'"):
            if val[0] in ('@', '`', '|', '>', '!', '&', '*', '%', '{', '['):
                problems.append((i, line.rstrip()))

if problems:
    print(f"\nPotential unquoted YAML special char issues ({len(problems)}):")
    for lineno, text in problems[:10]:
        print(f"  line {lineno}: {text}")
else:
    print("\nNo obvious YAML quoting issues found in pattern lines.")

print("\nDone.")
