"use client";

import React, { useState, useRef, useEffect } from "react";

interface SearchFeedbackProps {
  query: string;
  selectedResult?: string;
}

interface FeedbackEntry {
  query: string;
  wrongResult?: string;
  correctResult?: string;
  reportedAt: string;
  status: "pending" | "reviewed" | "fixed";
}

export default function SearchFeedback({ query, selectedResult }: SearchFeedbackProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"wrong" | "missing" | null>(null);
  const [correctInput, setCorrectInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFeedbackType(null);
        setCorrectInput("");
        setSubmitted(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setFeedbackType(null);
    setCorrectInput("");
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    if (!feedbackType) return;

    const feedback: FeedbackEntry = {
      query,
      wrongResult: selectedResult,
      correctResult: correctInput,
      reportedAt: new Date().toISOString(),
      status: "pending",
    };

    try {
      await fetch("/api/feedback/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedback),
      });
      setSubmitted(true);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs text-slate-500 hover:text-red-400 transition-colors"
      >
        Report Issue
      </button>

      {isOpen && (
        <div className="absolute right-0 top-8 z-50 w-72 p-3 rounded-lg border border-slate-600 bg-slate-800 shadow-lg">
          {!submitted ? (
            <>
              <p className="text-sm text-white mb-2">Report search issue:</p>
              
              <div className="space-y-2">
                <button
                  onClick={() => setFeedbackType("wrong")}
                  className={`w-full text-left px-3 py-2 rounded text-sm ${
                    feedbackType === "wrong" 
                      ? "bg-red-500/20 border border-red-500/30 text-red-400" 
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  Wrong result returned
                </button>
                
                <button
                  onClick={() => setFeedbackType("missing")}
                  className={`w-full text-left px-3 py-2 rounded text-sm ${
                    feedbackType === "missing"
                      ? "bg-red-500/20 border border-red-500/30 text-red-400"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  Company not found
                </button>
              </div>

              {feedbackType && (
                <div className="mt-3">
                  <input
                    type="text"
                    placeholder="Enter correct company name"
                    value={correctInput}
                    onChange={(e) => setCorrectInput(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleClose}
                      className="flex-1 px-3 py-1.5 rounded text-sm bg-slate-700 text-slate-300 hover:bg-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      className="flex-1 px-3 py-1.5 rounded text-sm bg-blue-600 text-white hover:bg-blue-500"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-green-400 text-center">Thanks for your feedback!</p>
          )}
        </div>
      )}
    </div>
  );
}
