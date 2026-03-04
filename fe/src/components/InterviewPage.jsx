import { useLocation, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { getVideoJobStatus, saveInterview, submitVideoJob } from "../auth/api";
import { useAuth } from "../auth/AuthContext";

export default function InterviewPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { token } = useAuth();
    const questions = location.state?.questions || [];
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedQuestion, setSelectedQuestion] = useState(questions[0] || "");
    const [results, setResults] = useState([]);
    const [isRecording, setIsRecording] = useState(false);
    const [videoBlob, setVideoBlob] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [timeLeft, setTimeLeft] = useState(120);
    const [error, setError] = useState("");
    const videoRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    const isLastQuestion = currentIndex === questions.length - 1;
    const completedCount = results.filter((r) => r && r.finalScore !== undefined).length;
    
    // Check if current question is already answered or being processed
    const isQuestionAnswered = results.some(
        r => r?.question === selectedQuestion && (r?.finalScore !== "Processing..." && r?.finalScore !== undefined)
    );
    const isQuestionProcessing = results.some(
        r => r?.question === selectedQuestion && r?.finalScore === "Processing..."
    );

    useEffect(() => {
        // Redirect if no questions are available
        if (!questions.length) {
            navigate("/", { replace: true });
            return;
        }

        let timer;
        if (isRecording) {
            setTimeLeft(120);
            timer = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        stopRecording();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [isRecording, questions, navigate]);

    const handleNext = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setSelectedQuestion(questions[currentIndex + 1]);
            resetRecording();
            setError("");
        }
    };

    const handlePrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
            setSelectedQuestion(questions[currentIndex - 1]);
            resetRecording();
            setError("");
        }
    };

    const handleSkip = () => {
        if (isQuestionAnswered || isQuestionProcessing) {
            setError("This question has already been answered or is being processed.");
            return;
        }

        setResults((prev) => {
            const updatedResults = [...prev];
            updatedResults[currentIndex] = {
                question: selectedQuestion,
                answerQuality: "Skipped",
                bodyLanguage: "N/A",
                finalScore: 0
            };
            return updatedResults;
        });
        handleNext();
    };

    const startRecording = async () => {
        if (isQuestionAnswered || isQuestionProcessing) {
            setError("This question has already been answered or is being processed.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            videoRef.current.srcObject = stream;
            videoRef.current.play();
            recordedChunksRef.current = [];

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) recordedChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, { type: "video/mp4" });
                setVideoBlob(blob);
                videoRef.current.srcObject = null;
                videoRef.current.src = URL.createObjectURL(blob);
            };

            mediaRecorder.start();
            setIsRecording(true);
            setError("");
        } catch (error) {
            console.error("Error starting recording:", error);
            setError("Failed to access camera/microphone. Please check your permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
            setIsRecording(false);
        }
    };

    const resetRecording = () => {
        setVideoBlob(null);
        setIsRecording(false);
        setTimeLeft(120);
        setError("");
    };

    const pollJob = async (jobId, { maxWaitMs = 10 * 60 * 1000, intervalMs = 2000 } = {}) => {
        const started = Date.now();
        while (Date.now() - started < maxWaitMs) {
            const data = await getVideoJobStatus(jobId);
            if (data.status === "done") return data.result;
            if (data.status === "failed") throw new Error(data.error || "Job failed");
            await new Promise((r) => setTimeout(r, intervalMs));
        }
        throw new Error("Timed out waiting for the NASA computer to finish the analysis.");
    };

    const handleSubmitVideo = async () => {
        if (isQuestionAnswered || isQuestionProcessing) {
            setError("This question has already been answered or is being processed.");
            return;
        }

        if (!videoBlob) {
            setError("Please record a video first!");
            return;
        }

        if (isProcessing) {
            setError("Please wait for the current video to finish processing.");
            return;
        }

        const currentQuestionIndex = currentIndex;
        setIsProcessing(true);
        setError("");
 
        // Add processing placeholder
        setResults((prev) => {
            const updatedResults = [...prev];
            updatedResults[currentQuestionIndex] = {
                question: selectedQuestion,
                answerQuality: "Processing...",
                bodyLanguage: "Processing...",
                finalScore: "Processing...",
            };
            return updatedResults;
        });

        resetRecording();
        handleNext();

        try {
            const queued = await submitVideoJob(videoBlob, selectedQuestion);
            const jobId = queued.jobId;
            const data = await pollJob(jobId);

            setResults((prev) => {
                const updatedResults = [...prev];
                updatedResults[currentQuestionIndex] = data;
                return updatedResults;
            });
        } catch (error) {
            console.error("Error analyzing video:", error);
            setResults((prev) => {
                const updatedResults = [...prev];
                updatedResults[currentQuestionIndex] = {
                    question: selectedQuestion,
                    answerQuality: "Failed to process",
                    bodyLanguage: "Failed to process",
                    finalScore: 0,
                };
                return updatedResults;
            });
            setError(error.message || "Failed to analyze video. Please try again or skip this question.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFinish = async () => {
        if (completedCount < questions.length) {
            setError("Please answer or skip all questions before finishing.");
            return;
        }

        const overallScore = results.reduce((sum, r) => {
            const score = typeof r?.finalScore === 'number' ? r.finalScore : 0;
            return sum + score;
        }, 0) / questions.length;

        try {
            let interviewId = null;
            if (token) {
                const payload = { questions, results, overallScore };
                const data = await saveInterview(payload, token);
                interviewId = data.interview?._id || null;
            }
            navigate("/results", { state: { results, overallScore, interviewId } });
        } catch (err) {
            console.error("Failed to save interview:", err);
            navigate("/results", { state: { results, overallScore } });
        }
    };

    return (
        <div className="flex min-h-screen flex-col bg-gray-100 md:h-screen md:flex-row">
            {/* Left Panel: Question List & Selected Question */}
            <div className="w-full bg-white shadow-lg p-4 md:w-1/3 md:p-6 flex flex-col">
                <h2 className="text-lg md:text-xl font-bold mb-3 md:mb-4">Interview Questions</h2>

                <ul className="border rounded-md max-h-56 overflow-y-auto md:max-h-none md:flex-1">
                    {questions.map((question, index) => {
                        const result = results.find((r) => r?.question === question);
                        const isAnswered = result && result.finalScore !== "Processing...";
                        const isProcessing = result && result.finalScore === "Processing...";

                        return (
                            <li
                                key={index}
                                className={`p-3 border-b flex justify-between items-center gap-3 text-sm sm:text-base cursor-pointer ${
                                    selectedQuestion === question ? "bg-blue-100" : "hover:bg-gray-200"
                                }`}
                                onClick={() => {
                                    setCurrentIndex(index);
                                    setSelectedQuestion(question);
                                    resetRecording();
                                }}
                            >
                                <span className="min-w-0 truncate">Question {index + 1}</span>
                                {isProcessing ? (
                                    <span className="text-blue-500 shrink-0">Processing...</span>
                                ) : isAnswered ? (
                                    <span className="text-green-500 font-bold">✔</span>
                                ) : (
                                    <span className="text-gray-400">○</span>
                                )}
                            </li>
                        );
                    })}
                </ul>

                {/* Selected Question */}
                {selectedQuestion && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-md shadow-sm">
                        <h3 className="text-base md:text-lg font-semibold">Selected Question</h3>
                        <p className="mt-1 text-sm md:text-base text-gray-700">{selectedQuestion}</p>
                    </div>
                )}

                {/* Error Display */}
                {error && (
                    <div className="mt-3 md:mt-4 p-3 bg-red-100 text-red-700 rounded-md text-sm md:text-base">
                        {error}
                    </div>
                )}
            </div>

            {/* Right Panel: Recording & Navigation */}
            <div className="w-full md:w-2/3 flex flex-col items-center justify-start md:justify-center p-4 md:p-6">
                <div className="mb-3 md:mb-4 w-full max-w-2xl rounded-md border border-slate-200 bg-white p-3 text-xs md:text-sm text-slate-700">
                    Video analysis runs on our "NASA computer" backend. If it is sleeping, first request can take 10-30 seconds to wake up.
                </div>
                {/* Timer Display */}
                <div className="text-base md:text-lg font-bold mb-3 md:mb-4">Time Left: {timeLeft}s</div>

                {/* Camera Preview */}
                <div className="w-full max-w-2xl aspect-video md:aspect-auto md:h-96 bg-black rounded-lg flex items-center justify-center shadow-lg relative overflow-hidden">
                    <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted />
                    {videoBlob && (
                        <video src={URL.createObjectURL(videoBlob)} controls className="absolute inset-0 w-full h-full" />
                    )}
                </div>

                {/* Recording Controls */}
                <div className="mt-5 md:mt-6 w-full max-w-2xl flex flex-col sm:flex-row sm:flex-wrap gap-3 md:gap-4">
                    {!isRecording ? (
                        <button
                            onClick={startRecording}
                            disabled={isQuestionAnswered || isQuestionProcessing}
                            className="w-full sm:w-auto px-6 py-3 bg-red-500 text-white text-base md:text-lg rounded hover:bg-red-600 disabled:opacity-50"
                        >
                            Start Recording
                        </button>
                    ) : (
                        <button
                            onClick={stopRecording}
                            className="w-full sm:w-auto px-6 py-3 bg-red-700 text-white text-base md:text-lg rounded hover:bg-red-800"
                        >
                            Stop Recording
                        </button>
                    )}

                    {videoBlob && (
                        <>
                            <button
                                onClick={handleSubmitVideo}
                                disabled={isProcessing || isQuestionAnswered || isQuestionProcessing}
                                className="w-full sm:w-auto px-6 py-3 bg-green-500 text-white text-base md:text-lg rounded hover:bg-green-600 disabled:opacity-50"
                            >
                                {isProcessing ? "Processing..." : "Submit Video"}
                            </button>
                            <button
                                onClick={resetRecording}
                                disabled={isQuestionAnswered || isQuestionProcessing}
                                className="w-full sm:w-auto px-6 py-3 bg-blue-500 text-white text-base md:text-lg rounded hover:bg-blue-600 disabled:opacity-50"
                            >
                                Retry Video
                            </button>
                        </>
                    )}
                </div>

                {/* Navigation Buttons */}
                <div className="mt-6 md:mt-8 w-full max-w-2xl flex flex-col sm:flex-row sm:justify-between gap-3 md:gap-4">
                    <button
                        onClick={handlePrevious}
                        disabled={currentIndex === 0}
                        className="w-full sm:w-auto px-6 py-3 bg-gray-300 text-gray-700 text-base md:text-lg rounded hover:bg-gray-400 disabled:opacity-50"
                    >
                        Previous
                    </button>

                    <button
                        onClick={handleSkip}
                        disabled={isQuestionAnswered || isQuestionProcessing}
                        className="w-full sm:w-auto px-6 py-3 bg-yellow-400 text-white text-base md:text-lg rounded hover:bg-yellow-500 disabled:opacity-50"
                    >
                        Skip
                    </button>

                    {isLastQuestion ? (
                        <button
                            onClick={handleFinish}
                            disabled={completedCount < questions.length || isProcessing}
                            className={`w-full sm:w-auto px-6 py-3 text-base md:text-lg rounded ${
                                completedCount < questions.length || isProcessing
                                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                    : "bg-purple-500 text-white hover:bg-purple-600"
                            }`}
                        >
                            Finish
                        </button>
                    ) : (
                        <button
                            onClick={handleNext}
                            className="w-full sm:w-auto px-6 py-3 bg-gray-300 text-gray-700 text-base md:text-lg rounded hover:bg-gray-400"
                        >
                            Next
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
