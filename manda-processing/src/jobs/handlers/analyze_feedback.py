"""
Analyze feedback job handler for weekly feedback analysis.
Story: E7.4 - Build Feedback Incorporation System (AC: #3, #4)

This handler processes analyze-feedback jobs from the pg-boss queue:
1. Aggregates feedback data (corrections, validations, rejections)
2. Calculates per-domain statistics
3. Detects patterns in feedback
4. Generates recommendations and threshold adjustments
5. Stores analysis results in feedback_analytics table

Job types:
- analyze-feedback: Full analysis for a deal
- analyze-feedback-all: Weekly analysis for all deals with feedback

Scheduling:
- Weekly job runs every Sunday at 2:00 AM UTC
- Can also be triggered manually via API
"""

import time
from datetime import datetime, timedelta
from typing import Any, Optional
from uuid import UUID

import structlog

from src.config import Settings, get_settings
from src.jobs.queue import Job, get_job_queue
from src.storage.supabase_client import (
    SupabaseClient,
    DatabaseError,
    get_supabase_client,
)

logger = structlog.get_logger(__name__)


# Pattern detection thresholds
MIN_SAMPLE_SIZE = 10
REJECTION_RATE_THRESHOLD = 0.30
CORRECTION_RATE_THRESHOLD = 0.20

# Default domain thresholds
DEFAULT_THRESHOLDS = {
    "financial": 0.70,
    "legal": 0.70,
    "operational": 0.60,
    "market": 0.55,
    "technical": 0.60,
    "general": 0.50,
}


class AnalyzeFeedbackHandler:
    """
    Handler for analyze-feedback jobs.

    Orchestrates the feedback analysis pipeline:
    Get Feedback -> Calculate Stats -> Detect Patterns -> Generate Recommendations -> Store Results
    """

    def __init__(
        self,
        db_client: Optional[SupabaseClient] = None,
        settings: Optional[Settings] = None,
    ):
        """
        Initialize the handler.

        Args:
            db_client: Supabase client (uses default if None)
            settings: Application settings (uses default if None)
        """
        self.db = db_client or get_supabase_client()
        self.settings = settings or get_settings()

    async def handle(self, job: Job) -> dict[str, Any]:
        """
        Handle an analyze-feedback job.

        Args:
            job: The job to process

        Returns:
            dict with success status and analysis summary
        """
        start_time = time.time()
        deal_id = job.data.get("deal_id")
        period_days = job.data.get("period_days", 7)
        analysis_type = job.data.get("analysis_type", "full")
        include_pattern_detection = job.data.get("include_pattern_detection", True)
        include_confidence_adjustments = job.data.get("include_confidence_adjustments", True)

        logger.info(
            "Starting feedback analysis",
            job_id=job.id,
            deal_id=deal_id,
            period_days=period_days,
            analysis_type=analysis_type,
        )

        try:
            if not deal_id:
                raise ValueError("deal_id is required")

            # Calculate period
            period_end = datetime.utcnow()
            period_start = period_end - timedelta(days=period_days)

            # 1. Get all findings for the deal
            findings = await self._get_findings(deal_id)

            if not findings:
                logger.info("No findings found for deal", deal_id=deal_id)
                summary = self._create_empty_summary(deal_id, period_start, period_end)
                await self._store_analysis(summary, analysis_type)
                return {
                    "success": True,
                    "summary": summary,
                    "processing_time_ms": int((time.time() - start_time) * 1000),
                }

            finding_ids = [f["id"] for f in findings]

            # 2. Get corrections in period
            corrections = await self._get_corrections(finding_ids, period_start, period_end)

            # 3. Get validation feedback in period
            validations = await self._get_validations(finding_ids, period_start, period_end)

            # 4. Calculate domain statistics
            domain_stats = self._calculate_domain_stats(findings, corrections, validations)

            # 5. Detect patterns
            patterns = []
            if include_pattern_detection:
                patterns = self._detect_patterns(findings, corrections, validations, domain_stats)

            # 6. Generate recommendations
            recommendations = self._generate_recommendations(domain_stats, patterns)

            # 7. Calculate confidence adjustments
            confidence_adjustments = []
            if include_confidence_adjustments:
                confidence_adjustments = await self._calculate_confidence_adjustments(
                    deal_id, domain_stats
                )

            # Build summary
            summary = {
                "deal_id": deal_id,
                "analysis_date": datetime.utcnow().isoformat(),
                "period_start": period_start.isoformat(),
                "period_end": period_end.isoformat(),
                "total_findings": len(findings),
                "total_corrections": len(corrections),
                "total_validations": len([v for v in validations if v.get("action") == "validate"]),
                "total_rejections": len([v for v in validations if v.get("action") == "reject"]),
                "patterns": patterns,
                "domain_stats": domain_stats,
                "recommendations": recommendations,
                "confidence_adjustments": confidence_adjustments,
            }

            # 8. Store analysis result
            await self._store_analysis(summary, analysis_type)

            processing_time_ms = int((time.time() - start_time) * 1000)

            logger.info(
                "Feedback analysis completed",
                job_id=job.id,
                deal_id=deal_id,
                total_findings=len(findings),
                total_corrections=len(corrections),
                patterns_detected=len(patterns),
                processing_time_ms=processing_time_ms,
            )

            return {
                "success": True,
                "summary": summary,
                "processing_time_ms": processing_time_ms,
            }

        except ValueError as e:
            logger.error("Invalid input for feedback analysis", error=str(e))
            return {"success": False, "error": str(e)}
        except DatabaseError as e:
            logger.error("Database error during feedback analysis", error=str(e))
            raise  # Retry on database errors
        except Exception as e:
            logger.exception("Unexpected error during feedback analysis")
            return {"success": False, "error": str(e)}

    async def _get_findings(self, deal_id: str) -> list[dict]:
        """Get all findings for a deal."""
        result = self.db.client.table("findings").select(
            "id, text, domain, document_id, confidence, needs_review, last_corrected_at"
        ).eq("deal_id", deal_id).execute()
        return result.data or []

    async def _get_corrections(
        self, finding_ids: list[str], period_start: datetime, period_end: datetime
    ) -> list[dict]:
        """Get corrections for findings in the given period."""
        if not finding_ids:
            return []
        result = self.db.client.table("finding_corrections").select(
            "id, finding_id, correction_type, created_at"
        ).in_("finding_id", finding_ids).gte(
            "created_at", period_start.isoformat()
        ).lte(
            "created_at", period_end.isoformat()
        ).execute()
        return result.data or []

    async def _get_validations(
        self, finding_ids: list[str], period_start: datetime, period_end: datetime
    ) -> list[dict]:
        """Get validation feedback for findings in the given period."""
        if not finding_ids:
            return []
        result = self.db.client.table("validation_feedback").select(
            "id, finding_id, action"
        ).in_("finding_id", finding_ids).gte(
            "created_at", period_start.isoformat()
        ).lte(
            "created_at", period_end.isoformat()
        ).execute()
        return result.data or []

    def _calculate_domain_stats(
        self,
        findings: list[dict],
        corrections: list[dict],
        validations: list[dict],
    ) -> list[dict]:
        """Calculate per-domain statistics."""
        domain_map = {}

        # Group findings by domain
        for finding in findings:
            domain = (finding.get("domain") or "general").lower()
            if domain not in domain_map:
                domain_map[domain] = {
                    "finding_ids": set(),
                    "confidences": [],
                    "correction_count": 0,
                    "validation_count": 0,
                    "rejection_count": 0,
                }
            domain_map[domain]["finding_ids"].add(finding["id"])
            if finding.get("confidence") is not None:
                domain_map[domain]["confidences"].append(finding["confidence"])

        # Count corrections per domain
        for correction in corrections:
            for domain, stats in domain_map.items():
                if correction["finding_id"] in stats["finding_ids"]:
                    stats["correction_count"] += 1
                    break

        # Count validations/rejections per domain
        for validation in validations:
            for domain, stats in domain_map.items():
                if validation["finding_id"] in stats["finding_ids"]:
                    if validation.get("action") == "validate":
                        stats["validation_count"] += 1
                    elif validation.get("action") == "reject":
                        stats["rejection_count"] += 1
                    break

        # Convert to list
        result = []
        for domain, stats in domain_map.items():
            total_feedback = stats["validation_count"] + stats["rejection_count"]
            avg_confidence = (
                sum(stats["confidences"]) / len(stats["confidences"])
                if stats["confidences"]
                else 0.5
            )
            rejection_rate = (
                stats["rejection_count"] / total_feedback if total_feedback > 0 else 0
            )
            result.append({
                "domain": domain,
                "finding_count": len(stats["finding_ids"]),
                "correction_count": stats["correction_count"],
                "validation_count": stats["validation_count"],
                "rejection_count": stats["rejection_count"],
                "average_confidence": round(avg_confidence, 3),
                "rejection_rate": round(rejection_rate, 3),
            })

        return result

    def _detect_patterns(
        self,
        findings: list[dict],
        corrections: list[dict],
        validations: list[dict],
        domain_stats: list[dict],
    ) -> list[dict]:
        """Detect patterns in feedback data."""
        patterns = []

        # Pattern 1: Domain bias (high rejection rate)
        for stats in domain_stats:
            if (
                stats["finding_count"] >= MIN_SAMPLE_SIZE
                and stats["rejection_rate"] > REJECTION_RATE_THRESHOLD
            ):
                severity = (
                    "high" if stats["rejection_rate"] > 0.5
                    else "medium" if stats["rejection_rate"] > 0.3
                    else "low"
                )
                patterns.append({
                    "pattern_type": "domain_bias",
                    "description": f"High rejection rate in {stats['domain']} domain ({int(stats['rejection_rate'] * 100)}%)",
                    "affected_count": stats["rejection_count"],
                    "severity": severity,
                    "recommendation": f"Review extraction prompts for {stats['domain']} domain.",
                    "examples": [],
                })

        # Pattern 2: Confidence drift
        for stats in domain_stats:
            if stats["finding_count"] >= MIN_SAMPLE_SIZE:
                correction_rate = stats["correction_count"] / stats["finding_count"]
                if correction_rate > CORRECTION_RATE_THRESHOLD and stats["rejection_rate"] < 0.1:
                    patterns.append({
                        "pattern_type": "confidence_drift",
                        "description": f"High correction rate in {stats['domain']} ({int(correction_rate * 100)}%) but low rejection",
                        "affected_count": stats["correction_count"],
                        "severity": "high" if correction_rate > 0.4 else "medium",
                        "recommendation": "Consider improving initial extraction precision.",
                        "examples": [],
                    })

        # Pattern 3: Source quality issues
        corrections_by_type = {}
        for correction in corrections:
            ctype = correction.get("correction_type", "unknown")
            corrections_by_type[ctype] = corrections_by_type.get(ctype, 0) + 1

        if corrections_by_type.get("source", 0) >= 5:
            count = corrections_by_type["source"]
            patterns.append({
                "pattern_type": "source_quality",
                "description": f"Multiple source corrections detected ({count} occurrences)",
                "affected_count": count,
                "severity": "high" if count > 20 else "medium" if count > 10 else "low",
                "recommendation": "Review source document quality.",
                "examples": [],
            })

        # Pattern 4: Extraction errors
        value_corrections = corrections_by_type.get("value", 0)
        if value_corrections >= 10:
            patterns.append({
                "pattern_type": "extraction_error",
                "description": f"Systematic value extraction errors ({value_corrections} corrections)",
                "affected_count": value_corrections,
                "severity": "high" if value_corrections > 30 else "medium" if value_corrections > 15 else "low",
                "recommendation": "Review LLM extraction prompts.",
                "examples": [],
            })

        return patterns

    def _generate_recommendations(
        self, domain_stats: list[dict], patterns: list[dict]
    ) -> list[dict]:
        """Generate recommendations based on analysis."""
        recommendations = []
        import uuid

        # Recommend threshold adjustments
        for stats in domain_stats:
            if (
                stats["rejection_rate"] > REJECTION_RATE_THRESHOLD
                and stats["finding_count"] >= MIN_SAMPLE_SIZE
            ):
                recommendations.append({
                    "id": str(uuid.uuid4()),
                    "type": "threshold_adjustment",
                    "priority": "high" if stats["rejection_rate"] > 0.5 else "medium",
                    "title": f"Adjust {stats['domain']} confidence threshold",
                    "description": f"{stats['domain']} has {int(stats['rejection_rate'] * 100)}% rejection rate.",
                    "actionable": True,
                    "auto_applicable": True,
                })

        # Recommendations from patterns
        for pattern in patterns:
            if pattern["pattern_type"] == "extraction_error" and pattern["severity"] != "low":
                recommendations.append({
                    "id": str(uuid.uuid4()),
                    "type": "prompt_improvement",
                    "priority": pattern["severity"],
                    "title": "Review extraction prompts",
                    "description": pattern["recommendation"],
                    "actionable": True,
                    "auto_applicable": False,
                })

            if pattern["pattern_type"] == "source_quality":
                recommendations.append({
                    "id": str(uuid.uuid4()),
                    "type": "source_review",
                    "priority": pattern["severity"],
                    "title": "Review source documents",
                    "description": pattern["recommendation"],
                    "actionable": True,
                    "auto_applicable": False,
                })

        return recommendations

    async def _calculate_confidence_adjustments(
        self, deal_id: str, domain_stats: list[dict]
    ) -> list[dict]:
        """Calculate confidence threshold adjustments."""
        adjustments = []

        for stats in domain_stats:
            if stats["finding_count"] < MIN_SAMPLE_SIZE:
                continue

            domain = stats["domain"]
            current_threshold = DEFAULT_THRESHOLDS.get(domain, DEFAULT_THRESHOLDS["general"])

            # Try to get deal-specific threshold
            result = self.db.client.table("confidence_thresholds").select(
                "threshold"
            ).eq("deal_id", deal_id).eq("domain", domain).execute()
            if result.data:
                current_threshold = result.data[0]["threshold"]

            # Calculate recommended threshold
            recommended = current_threshold
            if stats["rejection_rate"] > 0.4:
                recommended = min(0.95, current_threshold + 0.15)
            elif stats["rejection_rate"] > 0.25:
                recommended = min(0.90, current_threshold + 0.10)
            elif stats["rejection_rate"] < 0.05 and stats["validation_count"] > stats["finding_count"] * 0.5:
                recommended = max(0.40, current_threshold - 0.05)

            if abs(recommended - current_threshold) >= 0.05:
                # Calculate statistical confidence
                sample_confidence = min(1, stats["finding_count"] / 100)
                rate_extremity = abs(stats["rejection_rate"] - 0.5) * 2
                stat_confidence = sample_confidence * 0.7 + rate_extremity * sample_confidence * 0.3

                adjustments.append({
                    "domain": domain,
                    "current_threshold": round(current_threshold, 2),
                    "recommended_threshold": round(recommended, 2),
                    "reason": (
                        f"High rejection rate ({int(stats['rejection_rate'] * 100)}%)"
                        if stats["rejection_rate"] > 0.25
                        else "Low rejection rate with high validation"
                    ),
                    "based_on_sample_size": stats["finding_count"],
                    "statistical_confidence": round(stat_confidence, 2),
                })

        return adjustments

    async def _store_analysis(self, summary: dict, analysis_type: str) -> None:
        """Store analysis result in database."""
        try:
            self.db.client.table("feedback_analytics").upsert({
                "deal_id": summary["deal_id"],
                "analysis_date": datetime.utcnow().date().isoformat(),
                "period_start": summary["period_start"],
                "period_end": summary["period_end"],
                "analysis_type": analysis_type,
                "summary_json": summary,
                "total_findings": summary["total_findings"],
                "total_corrections": summary["total_corrections"],
                "total_validations": summary["total_validations"],
                "total_rejections": summary["total_rejections"],
                "pattern_count": len(summary["patterns"]),
                "recommendation_count": len(summary["recommendations"]),
                "trigger_type": "scheduled",
            }, on_conflict="deal_id,analysis_date").execute()
        except Exception as e:
            logger.warning("Failed to store analysis result", error=str(e))

    def _create_empty_summary(
        self, deal_id: str, period_start: datetime, period_end: datetime
    ) -> dict:
        """Create empty summary for deals with no findings."""
        return {
            "deal_id": deal_id,
            "analysis_date": datetime.utcnow().isoformat(),
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "total_findings": 0,
            "total_corrections": 0,
            "total_validations": 0,
            "total_rejections": 0,
            "patterns": [],
            "domain_stats": [],
            "recommendations": [],
            "confidence_adjustments": [],
        }


async def handle_analyze_feedback(job: Job) -> dict[str, Any]:
    """
    Entry point for analyze-feedback jobs.

    Args:
        job: The job to process

    Returns:
        dict with success status and analysis summary
    """
    handler = AnalyzeFeedbackHandler()
    return await handler.handle(job)


async def handle_analyze_feedback_all(job: Job) -> dict[str, Any]:
    """
    Entry point for analyze-feedback-all jobs.
    Runs analysis for all deals with feedback in the period.

    Args:
        job: The job to process

    Returns:
        dict with success status and count of analyses run
    """
    db = get_supabase_client()
    period_days = job.data.get("period_days", 7)
    period_start = datetime.utcnow() - timedelta(days=period_days)

    # Get all deals with feedback in the period
    # Join through findings to get unique deal_ids
    result = db.client.table("finding_corrections").select(
        "findings!inner(deal_id)"
    ).gte("created_at", period_start.isoformat()).execute()

    # Also check validation feedback
    validation_result = db.client.table("validation_feedback").select(
        "findings!inner(deal_id)"
    ).gte("created_at", period_start.isoformat()).execute()

    deal_ids = set()
    for row in (result.data or []):
        if row.get("findings", {}).get("deal_id"):
            deal_ids.add(row["findings"]["deal_id"])
    for row in (validation_result.data or []):
        if row.get("findings", {}).get("deal_id"):
            deal_ids.add(row["findings"]["deal_id"])

    logger.info(f"Running feedback analysis for {len(deal_ids)} deals")

    success_count = 0
    error_count = 0

    for deal_id in deal_ids:
        try:
            deal_job = Job(
                id=f"analyze-feedback-{deal_id}",
                name="analyze-feedback",
                data={"deal_id": deal_id, "period_days": period_days},
            )
            handler = AnalyzeFeedbackHandler(db_client=db)
            result = await handler.handle(deal_job)
            if result.get("success"):
                success_count += 1
            else:
                error_count += 1
        except Exception as e:
            logger.error(f"Failed to analyze feedback for deal {deal_id}", error=str(e))
            error_count += 1

    return {
        "success": error_count == 0,
        "total_deals": len(deal_ids),
        "success_count": success_count,
        "error_count": error_count,
    }