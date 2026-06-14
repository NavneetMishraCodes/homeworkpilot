from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from groq import Groq

import fitz
import pytesseract
from PIL import Image

import os

load_dotenv()

app = Flask(__name__)

CORS(app)

os.makedirs("uploads", exist_ok=True)

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)


def pdf_to_text(path):

    text = ""

    pdf = fitz.open(path)

    for page in pdf:
        text += page.get_text()

    pdf.close()

    return text


def image_to_text(path):

    image = Image.open(path)

    return pytesseract.image_to_string(image)


def ask_groq(prompt):

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    return response.choices[0].message.content


def build_prompt(
    homework,
    name,
    subject,
    class_name,
    teacher_style
):

    return f"""
Student: {name}

Class: {class_name}

Subject: {subject}

Teacher Style: {teacher_style}

Homework:

{homework}

Generate:

1. Overview
2. Daily Plan
3. Subjects
4. Key Learning Points
5. Checklist

Make it student-friendly.
"""


@app.route("/")
def home():

    return jsonify({
        "status": "online",
        "service": "HomeworkPilot AI"
    })


@app.route("/api/ask", methods=["POST"])
def ask():

    prompt = request.form.get(
        "homework",
        ""
    )

    if not prompt:
        return jsonify({
            "error": "Homework prompt required"
        }), 400

    final_prompt = build_prompt(
        prompt,
        request.form.get("name", "Student"),
        request.form.get("subject", "General"),
        request.form.get("class", ""),
        request.form.get(
            "teacher_style",
            "NORMAL"
        )
    )

    response = ask_groq(
        final_prompt
    )

    return jsonify({
        "response": response
    })


@app.route("/api/upload", methods=["POST"])
def upload():

    file = request.files.get("file")

    if not file:
        return jsonify({
            "error": "No file uploaded"
        }), 400

    filepath = os.path.join(
        "uploads",
        file.filename
    )

    file.save(filepath)

    try:

        if file.filename.lower().endswith(".pdf"):
            extracted_text = pdf_to_text(
                filepath
            )
        else:
            extracted_text = image_to_text(
                filepath
            )

        final_prompt = build_prompt(
            extracted_text,
            request.form.get("name", "Student"),
            request.form.get("subject", "General"),
            request.form.get("class", ""),
            request.form.get(
                "teacher_style",
                "NORMAL"
            )
        )

        response = ask_groq(
            final_prompt
        )

        return jsonify({
            "response": response
        })

    finally:

        if os.path.exists(filepath):
            os.remove(filepath)


if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=5000
    )