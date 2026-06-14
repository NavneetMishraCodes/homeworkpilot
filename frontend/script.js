const API_BASE_URL = "https://homeworkpilot.onrender.com";
const PROCESSING_MIN_TIME = 900;

const form = document.getElementById("homeworkForm");
const homeView = document.getElementById("homeView");
const processingView = document.getElementById("processingView");
const resultsView = document.getElementById("resultsView");
const nameInput = document.getElementById("nameInput");
const promptInput = document.getElementById("promptInput");
const subjectInput = document.getElementById("subjectInput");
const classInput = document.getElementById("classInput");
const teacherStyleInput = document.getElementById("teacherStyleInput");
const fileInput = document.getElementById("fileInput");
const uploadZone = document.getElementById("uploadZone");
const uploadTitle = document.getElementById("uploadTitle");
const uploadMeta = document.getElementById("uploadMeta");
const formHint = document.getElementById("formHint");
const processingTitle = document.getElementById("processingTitle");
const processingDetail = document.getElementById("processingDetail");
const progressBar = document.getElementById("progressBar");
const processingSteps = document.getElementById("processingSteps");
const resultGrid = document.getElementById("resultGrid");
const copyButton = document.getElementById("copyButton");
const newPlanButton = document.getElementById("newPlanButton");
const samplePromptButton = document.getElementById("samplePromptButton");
const toast = document.getElementById("toast");

let latestOutput = "";
let toastTimer;
let processingTimer;

const processingMessages = [
    {
        title: "Analyzing input...",
        detail: "Reading your homework context and identifying the main task."
    },
    {
        title: "Structuring plan...",
        detail: "Organizing the answer into a learning plan with clear sections."
    },
    {
        title: "Optimizing difficulty level...",
        detail: "Adapting the workload to your selected teacher style."
    },
    {
        title: "Checking learning points...",
        detail: "Highlighting the ideas and skills to review."
    },
    {
        title: "Finalizing response...",
        detail: "Preparing your homework plan for review."
    }
];

const resultSections = [
    {
        title: "Overview",
        icon: "book",
        patterns: ["overview", "summary", "goal", "assignment"]
    },
    {
        title: "Daily Plan",
        icon: "calendar",
        patterns: ["daily plan", "schedule", "timeline", "day"]
    },
    {
        title: "Subjects",
        icon: "layers",
        patterns: ["subjects", "subject", "topics", "topic"]
    },
    {
        title: "Key Learning Points",
        icon: "brain",
        patterns: ["key learning points", "learning points", "key points", "remember"]
    },
    {
        title: "Checklist",
        icon: "check",
        patterns: ["checklist", "to-do", "todo", "tasks"]
    }
];

const visualTemplates = [
    {
        title: "Overview",
        icon: "book",
        tone: "teal",
        patterns: ["overview", "summary", "goal", "assignment"]
    },
    {
        title: "Daily Plan",
        icon: "calendar",
        tone: "blue",
        patterns: ["daily plan", "schedule", "timeline", "day", "study plan", "plan"]
    },
    {
        title: "Subjects",
        icon: "layers",
        tone: "amber",
        patterns: ["subjects", "subject", "topics", "topic", "chapters"]
    },
    {
        title: "Key Learning Points",
        icon: "brain",
        tone: "rose",
        patterns: ["key learning points", "learning points", "key points", "remember", "skills"]
    },
    {
        title: "Checklist",
        icon: "check",
        tone: "green",
        patterns: ["checklist", "to-do", "todo", "tasks", "complete"]
    }
];

processingMessages.forEach((_, index) => {
    const dot = document.createElement("span");
    dot.dataset.step = String(index);
    processingSteps.appendChild(dot);
});

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const prompt = promptInput.value.trim();
    const file = fileInput.files[0];

    if (!prompt && !file) {
        formHint.textContent = "Add a prompt or upload a file before generating.";
        promptInput.focus();
        showToast("Add homework details first.");
        return;
    }

    setView(processingView);
    runProcessingAnimation();

    try {
        const [output] = await Promise.all([
            submitHomework(),
            delay(PROCESSING_MIN_TIME)
        ]);
        finishProcessingAnimation();
        latestOutput = normalizeOutput(output);
        renderResults(latestOutput);
        setView(resultsView);
    } catch (error) {
        finishProcessingAnimation();
        latestOutput = "";
        renderError(error);
        setView(resultsView);
    }
});

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];

    if (!file) {
        uploadTitle.textContent = "Upload image or PDF";
        uploadMeta.textContent = "Optional. Your file will be included with the plan request.";
        return;
    }

    uploadTitle.textContent = file.name;
    uploadMeta.textContent = `${formatFileSize(file.size)} selected`;
});

["dragenter", "dragover"].forEach((eventName) => {
    uploadZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        uploadZone.classList.add("is-dragging");
    });
});

["dragleave", "drop"].forEach((eventName) => {
    uploadZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        uploadZone.classList.remove("is-dragging");
    });
});

uploadZone.addEventListener("drop", (event) => {
    const file = event.dataTransfer.files[0];

    if (!file) {
        return;
    }

    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.files = transfer.files;
    fileInput.dispatchEvent(new Event("change"));
});

copyButton.addEventListener("click", async () => {
    if (!latestOutput) {
        showToast("No plan to copy yet.");
        return;
    }

    try {
        await navigator.clipboard.writeText(latestOutput);
        showToast("Plan copied.");
    } catch {
        showToast("Copy is not available in this browser.");
    }
});

newPlanButton.addEventListener("click", () => {
    setView(homeView);
    resultGrid.innerHTML = "";
    progressBar.style.width = "0%";
    window.scrollTo({ top: 0, behavior: "smooth" });
});

samplePromptButton.addEventListener("click", () => {
    promptInput.value = "Explain quadratic equations with one solved example, key formulas, and a short practice plan for tomorrow's math homework.";
    nameInput.value = "Student";
    subjectInput.value = "Math";
    classInput.value = "Class 10";
    formHint.textContent = "Sample prompt inserted.";
    document.getElementById("workspace").scrollIntoView({ behavior: "smooth", block: "start" });
    promptInput.focus();
});

document.querySelectorAll(".ripple-target").forEach((target) => {
    target.addEventListener("click", (event) => {
        const rect = target.getBoundingClientRect();
        const ripple = document.createElement("span");

        ripple.className = "ripple";
        ripple.style.left = `${event.clientX - rect.left}px`;
        ripple.style.top = `${event.clientY - rect.top}px`;
        target.appendChild(ripple);
        ripple.addEventListener("animationend", () => ripple.remove());
    });
});

function setView(activeView) {
    [homeView, processingView, resultsView].forEach((view) => {
        view.classList.toggle("is-active", view === activeView);
    });
}

function runProcessingAnimation() {
    const start = Date.now();
    const dots = [...processingSteps.children];

    clearInterval(processingTimer);
    updateProcessingStep(0, dots);
    progressBar.style.width = "0%";

    processingTimer = setInterval(() => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / 5200, 0.92);
        const stepIndex = Math.min(Math.floor(progress * processingMessages.length), processingMessages.length - 1);

        progressBar.style.width = `${Math.round(progress * 100)}%`;
        updateProcessingStep(stepIndex, dots);
    }, 180);
}

function finishProcessingAnimation() {
    const dots = [...processingSteps.children];

    clearInterval(processingTimer);
    updateProcessingStep(processingMessages.length - 1, dots);
    progressBar.style.width = "100%";
}

function updateProcessingStep(stepIndex, dots) {
    const message = processingMessages[stepIndex];

    processingTitle.textContent = message.title;
    processingDetail.textContent = message.detail;

    dots.forEach((dot, index) => {
        dot.classList.toggle("is-active", index === stepIndex);
    });
}

async function submitHomework() {
    const hasFile = !!fileInput.files[0];

    const endpoint = hasFile
        ? "/api/upload"
        : "/api/ask";

    const response = await fetch(
        `${API_BASE_URL}${endpoint}`,
        {
            method: "POST",
            body: buildHomeworkFormData()
        }
    );

    return parseApiResponse(response);
}

function buildHomeworkFormData() {
    const formData = new FormData();

    formData.append("name", nameInput.value.trim());
    formData.append("class", classInput.value.trim());
    formData.append("subject", subjectInput.value.trim());
    formData.append("homework", promptInput.value.trim());
    formData.append("teacher_notes", "");
    formData.append("teacher_style", teacherStyleInput.value);
    formData.append("additional_notes", "");

    if (fileInput.files[0]) {
        formData.append("file", fileInput.files[0]);
    }

    return formData;
}

async function parseApiResponse(response) {
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();

    if (!response.ok) {
        const message = typeof payload === "string" ? payload : payload.error || payload.message || "The AI service returned an error.";
        throw new Error(message);
    }

    if (typeof payload === "string") {
        return payload;
    }

    return payload.response || payload.result || payload.answer || payload.message || JSON.stringify(payload, null, 2);
}

function renderResults(output) {
    const model = buildVisualResult(output);

    resultGrid.innerHTML = `
        <article class="result-card result-overview" style="animation-delay: 0ms">
            <div class="overview-copy">
                <span class="section-kicker">Visual summary</span>
                <h3>${escapeHtml(model.title)}</h3>
                <p>${inlineFormat(model.summary)}</p>
            </div>
            <div class="insight-strip" aria-label="Response insights">
                ${model.insights.map((insight) => `
                    <span class="insight-chip">
                        <strong>${escapeHtml(insight.value)}</strong>
                        ${escapeHtml(insight.label)}
                    </span>
                `).join("")}
            </div>
        </article>
        ${model.sections.map((section, index) => `
            <article class="result-card visual-card tone-${section.tone}" style="animation-delay: ${(index + 1) * 80}ms">
                <h3><span class="result-icon">${getSectionIcon(section.icon)}</span>${escapeHtml(section.title)}</h3>
                ${formatVisualBody(section.body, section.title)}
            </article>
        `).join("")}
    `;
}

function renderError(error) {
    const message = error instanceof Error ? error.message : "Unable to reach the AI service.";

    resultGrid.innerHTML = `
        <article class="result-card">
            <h3><span class="result-icon">!</span>Connection Issue</h3>
            <p>${escapeHtml(message)}</p>
            <p>Check that the Render backend is reachable and that the <strong>/submit</strong> endpoint is responding.</p>
        </article>
    `;
}

function getSectionIcon(icon) {
    const icons = {
        book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11V20H5.5C4.7 20 4 19.3 4 18.5V5.5Z"></path><path d="M13 4H18.5C19.3 4 20 4.7 20 5.5V18.5C20 19.3 19.3 20 18.5 20H13V4Z"></path></svg>',
        steps: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7H9V11H5Z"></path><path d="M15 13H19V17H15Z"></path><path d="M9 9H12C13.7 9 15 10.3 15 12V15"></path></svg>',
        pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4L20 10L17 13L18 18L16 20L11 15L6 20L4 18L9 13L4 8L6 6L11 7L14 4Z"></path></svg>',
        calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3V6M17 3V6"></path><path d="M5 5H19C20.1 5 21 5.9 21 7V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V7C3 5.9 3.9 5 5 5Z"></path><path d="M3 10H21"></path></svg>'
    };

    return icons[icon] || icons.book;
}

function buildVisualResult(output) {
    const cleaned = normalizeOutput(output);
    const parsed = parseHeadedSections(cleaned).map((section) => ({
        title: section.title,
        body: section.body.trim()
    }));
    const sections = visualTemplates.map((template, index) => {
        const match = parsed.find((section) => {
            const heading = section.title.toLowerCase();
            return template.patterns.some((pattern) => heading.includes(pattern));
        });

        return {
            ...template,
            body: match ? match.body : inferSectionBody(cleaned, template.title, index)
        };
    });

    return {
        title: detectResultTitle(parsed),
        summary: createSummary(cleaned),
        insights: createInsights(cleaned, sections),
        sections
    };
}

function inferSectionBody(text, title, index) {
    const parts = splitIntoSmartChunks(text);

    return parts[index] || fallbackFor(title, text);
}

function detectResultTitle(parsed) {
    const firstHeading = parsed.find((section) => section.title && section.title.length < 70);

    if (firstHeading) {
        return firstHeading.title.replace(/[:*#]/g, "").trim();
    }

    return "Your Homework Plan";
}

function createSummary(text) {
    const sentences = text.match(/[^.!?]+[.!?]+|\S.+$/g) || [text];
    const cleanSentences = sentences.map((sentence) => sentence.trim()).filter(Boolean);
    const summary = cleanSentences.slice(0, 2).join(" ");

    return summary.length > 220 ? `${summary.slice(0, 217).trim()}...` : summary;
}

function createInsights(text, sections) {
    const words = text.split(/\s+/).filter(Boolean).length;
    const steps = extractOrderedItems(text).length || sections.length;
    const bullets = extractBulletItems(text).length;

    return [
        { value: String(sections.length), label: "sections" },
        { value: String(Math.max(steps, 1)), label: "steps" },
        { value: String(Math.max(bullets, 0)), label: "key points" },
        { value: `${Math.max(Math.ceil(words / 180), 1)} min`, label: "read" }
    ];
}

function formatVisualBody(body, title) {
    const text = body.trim();
    const orderedItems = extractOrderedItems(text);
    const bulletItems = extractBulletItems(text);

    if (orderedItems.length >= 2 || /step|solution|plan/i.test(title)) {
        const items = orderedItems.length >= 2 ? orderedItems : splitIntoActionItems(text);
        return `<ol class="step-timeline">${items.map((item) => `<li>${inlineFormat(item)}</li>`).join("")}</ol>`;
    }

    if (bulletItems.length >= 2 || /key|concept/i.test(title)) {
        const items = bulletItems.length >= 2 ? bulletItems : splitIntoActionItems(text);
        return `<div class="point-grid">${items.slice(0, 8).map((item) => `
            <div class="point-card">
                <span></span>
                <p>${inlineFormat(item)}</p>
            </div>
        `).join("")}</div>`;
    }

    return formatParagraphBlocks(text);
}

function formatParagraphBlocks(text) {
    const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
    const blocks = paragraphs.length ? paragraphs : splitIntoSmartChunks(text);

    return `<div class="explain-stack">${blocks.slice(0, 5).map((block) => `<p>${inlineFormat(block)}</p>`).join("")}</div>`;
}

function extractOrderedItems(text) {
    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^\d+[.)]\s+/.test(line))
        .map((line) => line.replace(/^\d+[.)]\s+/, ""))
        .filter(Boolean);
}

function extractBulletItems(text) {
    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^[-*\u2022]\s+/.test(line))
        .map((line) => line.replace(/^[-*\u2022]\s+/, ""))
        .filter(Boolean);
}

function splitIntoActionItems(text) {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    if (lines.length >= 2) {
        return lines.slice(0, 6).map((line) => line.replace(/^[-*\u2022]\s*|\d+[.)]\s*/, ""));
    }

    const sentences = text.match(/[^.!?]+[.!?]+|\S.+$/g) || [text];
    return sentences.map((sentence) => sentence.trim()).filter(Boolean).slice(0, 6);
}

function parseHeadedSections(text) {
    const lines = text.split(/\r?\n/);
    const sections = [];
    let current = null;

    lines.forEach((line) => {
        const trimmed = line.trim();
        const headingMatch = trimmed.match(/^#{1,3}\s+(.+)$|^\*\*(.+)\*\*:?\s*$|^([A-Z][A-Za-z -]{3,35}):$/);

        if (headingMatch) {
            if (current) {
                sections.push(current);
            }

            current = {
                title: (headingMatch[1] || headingMatch[2] || headingMatch[3]).trim(),
                body: ""
            };
            return;
        }

        if (current) {
            current.body += `${line}\n`;
        }
    });

    if (current) {
        sections.push(current);
    }

    return sections.filter((section) => section.body.trim());
}

function splitIntoSmartChunks(text) {
    const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

    if (paragraphs.length >= 4) {
        return paragraphs.slice(0, 4);
    }

    const sentences = text.match(/[^.!?]+[.!?]+|\S.+$/g) || [text];
    const chunkSize = Math.ceil(sentences.length / 4);

    return resultSections.map((_, index) => sentences.slice(index * chunkSize, (index + 1) * chunkSize).join(" ").trim()).filter(Boolean);
}

function fallbackFor(title, output) {
    const defaults = {
        "Concept Breakdown": output,
        "Step-by-step Solution": "Follow the plan above one step at a time, checking each answer before moving ahead.",
        "Key Points": "Review the main terms, formulas, dates, or reasoning patterns that appear in the answer.",
        "Study Plan": "Spend 10 minutes reviewing, 20 minutes solving, and 5 minutes checking your final work."
    };

    return defaults[title] || output;
}

function formatSectionBody(body) {
    const text = body.trim();
    const listItems = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^[-*\u2022]|\d+[.)]/.test(line));

    if (listItems.length >= 2) {
        const items = listItems.map((item) => item.replace(/^[-*\u2022]\s*|\d+[.)]\s*/, ""));
        return `<ul>${items.map((item) => `<li>${inlineFormat(item)}</li>`).join("")}</ul>`;
    }

    return `<p>${inlineFormat(text)}</p>`;
}

function inlineFormat(text) {
    return escapeHtml(text)
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/`([^`]+)`/g, "<span class=\"highlight\">$1</span>");
}

function normalizeOutput(output) {
    return String(output || "").trim() || "The AI returned an empty response.";
}

function formatFileSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
