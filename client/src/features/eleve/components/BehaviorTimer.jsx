import React from 'react';
import './BehaviorTimer.css';

export default function BehaviorTimer({ studentData }) {
    const records = Array.isArray(studentData?.behaviorRecords) ? studentData.behaviorRecords : [];
    const activeRecord = [...records].reverse().find((record) => Array.isArray(record?.scores) && record.scores.length)
        || records[records.length - 1];
    if (!activeRecord) return null;

    const grades = Array.isArray(activeRecord.scores) && activeRecord.scores.length
        ? activeRecord.scores
        : [{ id: 'legacy', value: Number(activeRecord.baseScore ?? 15) + Number(activeRecord.bonuses || 0) * 0.5 - Number(activeRecord.crosses || 0) }];
    const visibleGrades = activeRecord.forcedSix
        ? [...grades, { id: 'forced-six', value: 6, forced: true }]
        : grades;

    return (
        <div className="behavior-timer-wrapper">
            <div className="bt-section bonus">
                <div className="bt-header-row"><span className="bt-title green">📝 MES NOTES</span></div>
                <div className="bt-icons-container">
                    {visibleGrades.map((grade) => (
                        <div key={grade.id} className={`student-grade-chip ${grade.forced ? 'forced' : ''}`}>
                            {Number(grade.value).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
                        </div>
                    ))}
                </div>
                {activeRecord.workIncomplete && <div className="student-incomplete">TRAVAIL INCOMPLET</div>}
            </div>
        </div>
    );
}
