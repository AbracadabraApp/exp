-- Migration 002: Add pipeline metadata columns
-- Tracks progress through Pass 1 → Pass 2 → Pass 3 → Pass 4

-- Add writer persona column (assigned in Pass 3, used in Pass 4)
ALTER TABLE cards ADD COLUMN writer_type TEXT
  CHECK (writer_type IN ('travel_writer', 'food_enthusiast', 'religious_scholar', 'sailor', 'historian'));

COMMENT ON COLUMN cards.writer_type IS 'Writer persona assigned in Pass 3, used for Pass 4 voice generation';

-- Add pipeline pass tracking
ALTER TABLE cards ADD COLUMN pass1_timestamp TIMESTAMP;
ALTER TABLE cards ADD COLUMN pass2_plausible BOOLEAN;
ALTER TABLE cards ADD COLUMN pass2_reasoning TEXT;
ALTER TABLE cards ADD COLUMN pass2_timestamp TIMESTAMP;
ALTER TABLE cards ADD COLUMN pass3_verdict TEXT CHECK (pass3_verdict IN ('ACCEPT', 'REJECT', 'REVISE'));
ALTER TABLE cards ADD COLUMN pass3_revision_feedback TEXT;
ALTER TABLE cards ADD COLUMN pass3_revision_count INTEGER DEFAULT 0;
ALTER TABLE cards ADD COLUMN pass3_timestamp TIMESTAMP;
ALTER TABLE cards ADD COLUMN pass4_timestamp TIMESTAMP;

COMMENT ON COLUMN cards.pass1_timestamp IS 'When this card was generated in Pass 1';
COMMENT ON COLUMN cards.pass2_plausible IS 'Did this card pass the Pass 2 plausibility check?';
COMMENT ON COLUMN cards.pass2_reasoning IS 'Pass 2 reasoning for verdict';
COMMENT ON COLUMN cards.pass3_verdict IS 'Pass 3 quality verdict: ACCEPT, REJECT, or REVISE';
COMMENT ON COLUMN cards.pass3_revision_feedback IS 'Feedback from Pass 3 if verdict was REVISE';
COMMENT ON COLUMN cards.pass3_revision_count IS 'Number of revision attempts (max 1)';
COMMENT ON COLUMN cards.pass4_timestamp IS 'When this card was enriched in Pass 4';

-- Add rejection tracking
ALTER TABLE cards ADD COLUMN rejected_at_pass TEXT;
ALTER TABLE cards ADD COLUMN rejection_reason TEXT;

COMMENT ON COLUMN cards.rejected_at_pass IS 'Which pass rejected this card: pass2, pass3, or null if not rejected';
COMMENT ON COLUMN cards.rejection_reason IS 'Why this card was rejected';

-- Update status constraint to include pipeline stages
ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_status_check;
ALTER TABLE cards ADD CONSTRAINT cards_status_check
  CHECK (status IN ('draft', 'pass2_plausible', 'pass3_approved', 'ready', 'published', 'archived', 'rejected'));

COMMENT ON COLUMN cards.status IS 'Pipeline status: draft (Pass 1) → pass2_plausible → pass3_approved → ready (Pass 4 complete) → published → archived or rejected';

-- Add indexes for pipeline queries
CREATE INDEX idx_cards_pipeline_status ON cards(status)
  WHERE status IN ('draft', 'pass2_plausible', 'pass3_approved', 'ready');

CREATE INDEX idx_cards_pass2_ready ON cards(pass1_timestamp)
  WHERE pass2_timestamp IS NULL AND status = 'draft';

CREATE INDEX idx_cards_pass3_ready ON cards(pass2_timestamp)
  WHERE pass3_timestamp IS NULL AND pass2_plausible = true;

CREATE INDEX idx_cards_pass4_ready ON cards(pass3_timestamp)
  WHERE pass4_timestamp IS NULL AND pass3_verdict = 'ACCEPT';

CREATE INDEX idx_cards_rejected ON cards(rejected_at_pass)
  WHERE rejected_at_pass IS NOT NULL;

-- Helper function to parse "Alba, Piedmont, Italy" → structured location
CREATE OR REPLACE FUNCTION parse_location(where_string TEXT)
RETURNS TABLE(city TEXT, region TEXT, country TEXT) AS $$
DECLARE
  parts TEXT[];
BEGIN
  IF where_string IS NULL THEN
    RETURN;
  END IF;

  parts := string_to_array(where_string, ',');

  RETURN QUERY SELECT
    TRIM(parts[1]),                    -- city
    CASE WHEN array_length(parts, 1) > 1 THEN TRIM(parts[2]) ELSE NULL END,  -- region
    CASE WHEN array_length(parts, 1) > 2 THEN LOWER(TRIM(parts[3])) ELSE NULL END;  -- country
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION parse_location IS 'Parse Pass 1 "where" string like "Alba, Piedmont, Italy" into structured location fields';

-- Helper function to map month names to seasons
CREATE OR REPLACE FUNCTION month_to_season(month_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    WHEN month_name IN ('December', 'January', 'February') THEN 'winter'
    WHEN month_name IN ('March', 'April', 'May') THEN 'spring'
    WHEN month_name IN ('June', 'July', 'August') THEN 'summer'
    WHEN month_name IN ('September', 'October', 'November') THEN 'autumn'
    ELSE 'year_round'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION month_to_season IS 'Map month name to season for when_season field';

-- View for pipeline progress monitoring
CREATE VIEW pipeline_progress AS
SELECT
  status,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE pass1_timestamp IS NOT NULL) as pass1_complete,
  COUNT(*) FILTER (WHERE pass2_timestamp IS NOT NULL) as pass2_complete,
  COUNT(*) FILTER (WHERE pass2_plausible = true) as pass2_survived,
  COUNT(*) FILTER (WHERE pass3_timestamp IS NOT NULL) as pass3_complete,
  COUNT(*) FILTER (WHERE pass3_verdict = 'ACCEPT') as pass3_accepted,
  COUNT(*) FILTER (WHERE pass3_verdict = 'REVISE') as pass3_needs_revision,
  COUNT(*) FILTER (WHERE pass4_timestamp IS NOT NULL) as pass4_complete,
  COUNT(*) FILTER (WHERE rejected_at_pass IS NOT NULL) as rejected,
  ROUND(AVG(pass3_revision_count), 2) as avg_revisions
FROM cards
GROUP BY status
ORDER BY
  CASE status
    WHEN 'draft' THEN 1
    WHEN 'pass2_plausible' THEN 2
    WHEN 'pass3_approved' THEN 3
    WHEN 'ready' THEN 4
    WHEN 'published' THEN 5
    WHEN 'rejected' THEN 6
    WHEN 'archived' THEN 7
  END;

COMMENT ON VIEW pipeline_progress IS 'Monitor pipeline progress: how many cards at each stage, survival rates, etc.';

-- View for rejected cards analysis
CREATE VIEW rejected_cards_analysis AS
SELECT
  rejected_at_pass,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM cards
WHERE rejected_at_pass IS NOT NULL
GROUP BY rejected_at_pass
ORDER BY count DESC;

COMMENT ON VIEW rejected_cards_analysis IS 'Analyze where cards are being rejected in the pipeline';
