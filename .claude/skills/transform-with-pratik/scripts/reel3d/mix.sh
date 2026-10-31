set -e
cd /home/claude/reel/aud
# music bed: duck under voice (sidechain), EQ dip for speech clarity
ffmpeg -v error -y -i voice.wav -i music.wav -i sfx.wav -filter_complex "\
[0:a]aresample=48000,asplit=2[v1][vsc];\
[1:a]aresample=48000,highpass=f=40,equalizer=f=2500:t=q:w=1.2:g=-3,volume=-7dB[m];\
[m][vsc]sidechaincompress=threshold=0.03:ratio=3:attack=15:release=250:makeup=1[md];\
[2:a]aresample=48000,volume=-4dB[s];\
[v1][md][s]amix=inputs=3:normalize=0:duration=first[mx]" -map "[mx]" -ac 2 mix_raw.wav
J=$(ffmpeg -hide_banner -i mix_raw.wav -af loudnorm=I=-14:TP=-1.2:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
mi=$(echo "$J" | python3 -c "import json,sys;j=json.load(sys.stdin);print(f\"measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}\")")
ffmpeg -v error -y -i mix_raw.wav -af "loudnorm=I=-14:TP=-1.2:LRA=11:$mi:linear=true,alimiter=limit=0.71:attack=2:release=40:level=disabled,aresample=48000" -ar 48000 mix.wav
ffmpeg -hide_banner -i mix.wav -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:" | tail -2
