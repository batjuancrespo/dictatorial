from flask import Flask, request, jsonify
import deepspeech
import numpy as np
import wave
import io

app = Flask(__name__)

# Cargar el modelo de DeepSpeech
model_file_path = 'deepspeech-model.pbmm'
model = deepspeech.Model(model_file_path)

@app.route('/transcribe', methods=['POST'])
def transcribe():
    # Recibir archivo de audio (en formato WAV)
    audio_data = request.files['audio']
    audio_file = wave.open(io.BytesIO(audio_data.read()), 'rb')

    # Extraer frames y convertir a formato compatible con DeepSpeech
    frames = audio_file.getnframes()
    buffer = audio_file.readframes(frames)
    audio = np.frombuffer(buffer, dtype=np.int16)

    # Transcribir usando DeepSpeech
    text = model.stt(audio)
    return jsonify({'transcription': text})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
