export async function executeCode(code: string, language: string) {
  const languageMap: Record<string, number> = {
    javascript: 102, // Node 22
    typescript: 101, // TS 5.6
    python: 100, // Python 3.12
    java: 91, // JDK 17
    cpp: 105, // C++ GCC 14
    c: 103, // C GCC 14
    go: 107, // Go 1.23
    rust: 108, // Rust 1.85
  };

  const id = languageMap[language.toLowerCase()] ?? 43; // 43=Plain text if not found

  try {
    const res = await fetch("https://ce.judge0.com/submissions?base64_encoded=false&wait=true", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_code: code,
        language_id: id,
      }),
      // Set an aggressive timeout
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
        console.error("Judge0 error", await res.text());
        return null;
    }

    const data = await res.json();
    return {
      status: data.status?.description,
      stdout: data.stdout,
      stderr: data.stderr,
      compileOutput: data.compile_output,
      time: data.time,
      memory: data.memory,
    };
  } catch (error) {
    console.error("Judge0 exception:", error);
    return null;
  }
}
