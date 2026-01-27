#!/usr/bin/env python3
"""
Whisper transcription script for video analyzer.
Uses the Whisper Python API directly for reliability.
"""

import whisper
import json
import sys

def transcribe_audio(audio_path, model_size='base'):
    """Transcribe audio file using Whisper."""
    try:
        # Load model
        model = whisper.load_model(model_size)
        
        # Transcribe
        result = model.transcribe(
            audio_path,
            language='en',
            verbose=False
        )
        
        # Format output as JSON
        segments = []
        for segment in result['segments']:
            segments.append({
                'start': segment['start'],
                'end': segment['end'],
                'text': segment['text'].strip()
            })
        
        output = {
            'text': result['text'],
            'segments': segments,
            'language': result['language']
        }
        
        print(json.dumps(output))
        return 0
        
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        return 1

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: whisper_transcribe.py <audio_file> [model_size]', file=sys.stderr)
        sys.exit(1)
    
    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else 'base'
    
    sys.exit(transcribe_audio(audio_path, model_size))
