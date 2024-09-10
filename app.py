from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper
import os

app = Flask(__name__)

# Cargar el modelo Whisper una sola vez para evitar recargarlo en cada solicitud
model = whisper.load_model("tiny")


@app.route('/transcribe', methods=['POST'])
def transcribe():
    # Recibir archivo de audio
    if 'audio' not in request.files:
        return jsonify({'error': 'No se envió ningún archivo de audio'})

    audio_data = request.files['audio']
    audio_file_path = "temp_audio.wav"
    audio_data.save(audio_file_path)

    # Transcribir usando Whisper
    result = model.transcribe(audio_file_path)
    os.remove(audio_file_path)  # Eliminar archivo temporal después de la transcripción

    return jsonify({'transcription': result['text']})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)



# Habilitar CORS en toda la app Flask
CORS(app)
