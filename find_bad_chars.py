with open('H:/bots/f34rless-moderation/config.yml', 'rb') as f:
    data = f.read()

print(f"File size: {len(data)} bytes")
bad = []
for i, b in enumerate(data):
    # YAML only allows: tab (0x09), LF (0x0A), CR (0x0D), and 0x20-0x7E, 0x85, 0xA0-0xD7FF, 0xE000-0xFFFD
    if b < 0x09 or (0x0B <= b <= 0x0C) or (0x0E <= b <= 0x1F) or (0x7F <= b <= 0x84) or (0x86 <= b <= 0x9F):
        bad.append((i, b))

print(f"Found {len(bad)} bad characters:")
for pos, b in bad[:20]:
    start = max(0, pos-50)
    end = min(len(data), pos+50)
    ctx = data[start:end]
    print(f"  pos {pos}: 0x{b:02X} - context: {ctx!r}")
