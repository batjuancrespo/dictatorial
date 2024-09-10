from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper
import os

app = Flask(__name__)

# Configurar CORS para permitir solicitudes desde tu frontend en GitHub Pages
CORS(app, resources={r"/transcribe": {"origins": "batjuancrespo.github.io/battac/"}})

# Cargar el modelo de Whisper (puedes usar otros modelos como "base", "small", "medium", "large")
model = whisper.load_model("tiny")

@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file found"}), 400
    
    audio_file = request.files['audio']
    file_path = os.path.join("/tmp", "temp_audio.wav")
    audio_file.save(file_path)

    # Realizar la transcripción con Whisper
    result = model.transcribe(file_path, language="es")

    # Eliminar el archivo temporal
    os.remove(file_path)

    return jsonify({"transcription": result['text']})

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
