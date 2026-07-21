import os
import math
import struct
import wave

def create_sample_wav(filepath, title, duration_sec=12, freq_base=440.0):
    """
    Generates a pleasant synthetic chord song sample audio (WAV format).
    """
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    sample_rate = 44100
    num_samples = sample_rate * duration_sec
    
    # Simple melody progression notes (frequencies in Hz)
    chords = [
        [freq_base, freq_base * 1.25, freq_base * 1.5],        # Major chord
        [freq_base * 1.125, freq_base * 1.333, freq_base * 1.667], # Minor/Subdominant
        [freq_base * 0.888, freq_base * 1.125, freq_base * 1.333], # Dominant
        [freq_base, freq_base * 1.25, freq_base * 1.5]         # Major chord resolved
    ]
    
    with wave.open(filepath, 'w') as wav_file:
        wav_file.setnchannels(2) # Stereo
        wav_file.setsampwidth(2) # 16-bit
        wav_file.setframerate(sample_rate)
        
        for i in range(num_samples):
            t = i / sample_rate
            chord_idx = int((t / duration_sec) * len(chords)) % len(chords)
            chord = chords[chord_idx]
            
            # Envelope (fade in / out)
            env = math.sin(math.pi * t / duration_sec)
            
            # Synthesize wave with harmonics
            val_l = 0.0
            val_r = 0.0
            for j, f in enumerate(chord):
                wave_val = math.sin(2 * math.pi * f * t) + 0.3 * math.sin(4 * math.pi * f * t)
                val_l += wave_val * (0.3 if j % 2 == 0 else 0.2)
                val_r += wave_val * (0.2 if j % 2 == 0 else 0.3)
                
            val_l *= env * 12000
            val_r *= env * 12000
            
            sample_l = int(max(-32768, min(32767, val_l)))
            sample_r = int(max(-32768, min(32767, val_r)))
            
            data = struct.pack('<hh', sample_l, sample_r)
            wav_file.writeframesraw(data)

def generate_default_songs():
    song_structure = [
        ("songs/English/flack/song1.mp3", "Starlight Symphony", 15, 523.25),
        ("songs/English/flack/song2.mp3", "Neon Glass Horizon", 18, 587.33),
        ("songs/English/normal/song3.mp3", "Velvet Chill Beat", 14, 440.00),
        ("songs/English/normal/song4.mp3", "Midnight Periwinkle", 16, 659.25),
        ("songs/Hindi/flack/song5.mp3", "Resham Raga (High Res)", 20, 392.00),
        ("songs/Hindi/normal/song6.mp3", "Monsoon Breeze", 15, 349.23),
        ("songs/Hindi/normal/song7.mp3", "Subah Ki Dhun", 17, 329.63),
    ]
    
    for path, title, dur, freq in song_structure:
        if not os.path.exists(path):
            print(f"Generating sample audio: {path} ({title})")
            create_sample_wav(path, title, dur, freq)

if __name__ == "__main__":
    generate_default_songs()
