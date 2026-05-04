-- Migration: 001_initial
-- Description: Initial schema for travel experience cards
-- Date: 2026-05-04
-- Author: Database Engineer

-- Enable UUID extension (required for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core cards table: holds both experience-cards and list-cards
CREATE TABLE cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    headline TEXT NOT NULL, -- No UNIQUE constraint: legitimate duplicates exist across locations
    subhead TEXT,
    body TEXT, -- Full prose entry
    cover_image_url TEXT, -- Local: /images/cards/{id}.jpg, future: https://cdn.example.com/...

    -- Experience-card fields (null for list-cards)
    where_country TEXT, -- ISO-style: 'italy', 'japan' (controlled vocabulary, app-enforced)
    where_region TEXT, -- Free text: 'Emilia-Romagna'
    where_city TEXT, -- Free text: 'Bologna'
    lat REAL,
    lng REAL,
    place_id TEXT, -- Google Places ID for caching
    when_season TEXT, -- Controlled vocabulary: spring, summer, autumn, winter, year_round
    when_time_of_day TEXT, -- Controlled vocabulary: pre_dawn, dawn, morning, etc.
    when_specific_date TEXT, -- ISO date or null
    source TEXT, -- Citation: book title, URL, article, etc.
    source_type TEXT, -- 'book', 'article', 'url', 'documentary', etc.
    sensory_anchor TEXT, -- One sensory detail

    -- List-card fields (null for experience-cards)
    member_card_ids JSONB, -- Ordered array: ["card-uuid-001", "card-uuid-042", ...]
    curator_notes TEXT, -- Editorial intro for list-card

    -- Shared metadata
    themes JSONB, -- Array of theme strings from controlled vocabulary
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'published', 'archived')),
    prompt_version TEXT, -- Which AI prompt generated this
    generated_by TEXT, -- Model name: 'claude-sonnet-4-6'

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_cards_status ON cards(status);
CREATE INDEX idx_cards_country ON cards(where_country) WHERE where_country IS NOT NULL;
CREATE INDEX idx_cards_created ON cards(created_at DESC);

-- GIN index for themes array (efficient JSONB containment queries)
CREATE INDEX idx_cards_themes ON cards USING GIN (themes);

-- GIN index for member_card_ids array (find lists containing a card)
CREATE INDEX idx_cards_member_ids ON cards USING GIN (member_card_ids);

-- Composite index for filtering experience-cards by location
CREATE INDEX idx_cards_location ON cards(where_country, where_region, where_city)
    WHERE where_country IS NOT NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cards_updated_at
    BEFORE UPDATE ON cards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Helper views for querying

-- Experience-cards only (where_country is populated)
CREATE VIEW experience_cards AS
SELECT * FROM cards
WHERE where_country IS NOT NULL;

-- List-cards only (member_card_ids is populated)
CREATE VIEW list_cards AS
SELECT * FROM cards
WHERE member_card_ids IS NOT NULL;

-- Card type determination helper
CREATE OR REPLACE FUNCTION get_card_type(card_row cards)
RETURNS TEXT AS $$
BEGIN
    IF card_row.member_card_ids IS NOT NULL THEN
        RETURN 'list';
    ELSIF card_row.where_country IS NOT NULL THEN
        RETURN 'experience';
    ELSE
        RETURN 'unknown';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Comments for documentation
COMMENT ON TABLE cards IS 'Unified table: experience-cards describe single experiences, list-cards collect member cards';
COMMENT ON COLUMN cards.member_card_ids IS 'For list-cards: ordered array of card UUIDs. Null for experience-cards.';
COMMENT ON COLUMN cards.where_country IS 'For experience-cards: location identifier. Null for list-cards.';
COMMENT ON COLUMN cards.themes IS 'Array of theme strings from controlled vocabulary (app-enforced, not DB constraint)';
COMMENT ON COLUMN cards.headline IS 'No UNIQUE constraint: legitimate duplicates exist (e.g., same ritual in different towns)';

-- Migration tracking table (for future migrations)
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Record this migration
INSERT INTO schema_migrations (version, name) VALUES (1, '001_initial');
