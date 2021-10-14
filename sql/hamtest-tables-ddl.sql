-- CREATE DATABASE hamtest WITH TEMPLATE = template0 ENCODING = 'UTF8' LC_COLLATE = 'en_US.UTF-8' LC_CTYPE = 'en_US.UTF-8' TABLESPACE = hamtest_tspace; 
-- ALTER DATABASE hamtest OWNER TO hamtest_owner; 
-- \connect hamtest -- Table BAND, version 1
-->> TABLES

-- Table: BAND, version 1
-- maps frequency range to band (for Cabrillo input) 
CREATE TABLE public.band ( 
  band_pk serial primary key,
  band_id varchar(20) NOT NULL,
  freq_khz_low integer NOT NULL,
  freq_khz_high integer NOT NULL,
  CONSTRAINT ck_band_frequency CHECK (freq_khz_low <= freq_khz_high));
ALTER TABLE public.band OWNER TO hamtest_owner;
COMMENT ON TABLE public.band IS 'Frequency to band map';
COMMENT ON CONSTRAINT ck_band_frequency ON public.band IS 'Frequency low is less than frequency high'; 
INSERT INTO public.band (band_id, freq_khz_low, freq_khz_high)
VALUES 
('160m',1750,2000),
('80m',3500,4000),
('40m',7000,7300),
('20m',14000,14350),
('15m',21000,21450),
('10m',28000,29700); 

--> Table: CABRILLO_TEMPLATE, version 1
-- Mapping templates for Cabrillo input 
CREATE TABLE public.cabrillo_template ( 
  tpl_pk      serial primary key,
  tpl_name    varchar(20) NOT NULL,
  tpl_descr   varchar(255),
  tpl_pattern varchar(20) NOT NULL,
  tpl_fields  varchar(255) NOT NULL);
ALTER TABLE public.cabrillo_template OWNER TO hamtest_owner;
CREATE INDEX x_template_name ON public.cabrillo_template USING btree (tpl_name);
CREATE UNIQUE INDEX x_template_rec ON public.cabrillo_template USING btree (tpl_name, tpl_pattern);
COMMENT ON TABLE public.cabrillo_template IS 'Cabrillo templates based on patterns';
COMMENT ON COLUMN public.cabrillo_template.tpl_pk IS 'Autogenerated primary key';
COMMENT ON COLUMN public.cabrillo_template.tpl_name IS 'Ruleset namey';
COMMENT ON COLUMN public.cabrillo_template.tpl_descr IS 'Rule description';
COMMENT ON COLUMN public.cabrillo_template.tpl_pattern IS 'Data pattern detected';
COMMENT ON COLUMN public.cabrillo_template.tpl_fields IS 'Field order (mapping) for the pattern detected'; 
INSERT INTO public.cabrillo_template (tpl_name, tpl_descr, tpl_pattern, tpl_fields)
values 
  ('GENERAL', 'General pattern for exchange = RST + serial', 'CRNCRN', 'calls,rsts,nrs,callr,rstr,nrr'),
  ('GENERAL', 'General pattern for exchange = RST + serial + WWLOC (VHF contests)', 'CRNLCRNL', 'calls,rsts,nrs,exc1s,callr,rstr,nrr,exc1r'), 
  ('CWT', 'CWOps minitest (no rst, name, member#/country)', 'CS(N|S)CS(N|S)', 'calls,exc1s,exc2s,callr,exc1r,exc2r'), 
  ('OL-PARTY', 'OL-PARTY pattern for ex-OL stations', 'CRNCCRNC',  'calls,rsts,nrs,exc1s,callr,rstr,nrr,exc1r'), 
  ('OL-PARTY', 'OL-PARTY pattern for non-ex-OL stations', 'CRNCRNC', 'calls,rsts,nrs,callr,rstr,nrr,exc1r'), 
  ('CAV-TEST', 'CAV Contest pattern for non-members','CR(N|S)CR(N|S)', 'calls,rsts,exc1s,callr,rstr,exc1r'); 

--> Table: CONTEST_STATUS, version 1
-- Status for GUI and log acceptance control 
CREATE TABLE public.contest_status (
  ctst_status character(1) NOT NULL primary key,
  status_name varchar(80) NOT NULL UNIQUE,
  status_descr text); 

ALTER TABLE public.contest_status OWNER TO hamtest_owner; 
COMMENT ON TABLE public.contest_status IS 'List of codes for contest status'; 
COMMENT ON COLUMN public.contest_status.ctst_status IS 'Status code'; 
COMMENT ON COLUMN public.contest_status.status_name IS 'Status name'; 
COMMENT ON COLUMN public.contest_status.status_descr IS 'Status definition'; 

INSERT INTO public.contest_status (ctst_status, status_name, status_descr)
VALUES 
  ('W', 'WAITING', 'Contest not open to receive logs yet'),
  ('O', 'OPEN', 'Contest is open to receive logs'),
  ('C', 'CLOSED', 'Contest will not receive any more logs. Computation and editing is possible in database.'),
  ('P', 'PRELIMINARY', 'Log conditioning completed, results calculated.'),
  ('F', 'FINAL', 'Results are computed and approved, data are frozen (no more editing or evaluation)'),
  ('X', 'PUBLISHED', 'Results were published, data are ready to be archived')
;

--> Table: CONTEST, version 1
-- This table represents contest instance, i.e. contest held at particular time
-- CTST_NAME must be unique, so for contests like CWOps Minitest or Memorial OK1WC
-- include date string, e.g. MWC-2021-10-11 or CWT-211013-13 (CWT at 13 UTC) 
CREATE TABLE public.contest ( 
  ctst_pk   serial not null primary key,
  ctst_name varchar(255) NOT NULL UNIQUE,
  utc_from  timestamp without time zone NOT NULL,
  utc_to    timestamp without time zone NOT NULL,
  cabr_template_id varchar(80) DEFAULT 'GENERAL'::varchar, note text, ctst_status character(1),
  CONSTRAINT c_contest_start_end CHECK (utc_from < utc_to)
); 
CREATE INDEX x_ctst_from ON public.contest USING btree (utc_from);
CREATE INDEX x_ctst_to   ON public.contest USING btree (utc_to);
ALTER TABLE public.contest OWNER TO hamtest_owner; 

COMMENT ON TABLE public.contest IS 'Contest list'; 
COMMENT ON COLUMN public.contest.ctst_pk IS 'Autogenerated primary key'; 
COMMENT ON COLUMN public.contest.ctst_name IS 'Contest name (must be unique)'; 
COMMENT ON COLUMN public.contest.utc_from IS 'Contest start date and time in UTC (inclusive)'; 
COMMENT ON COLUMN public.contest.utc_to IS 'Contest end date and time in UTC (inclusive)'; 
COMMENT ON COLUMN public.contest.cabr_template_id IS 'Name of the cabrillo format template set to be used'; 
COMMENT ON COLUMN public.contest.note IS 'Any remark about contest'; 
COMMENT ON COLUMN public.contest.ctst_status IS 'Contest evaluation status as defined in CONTEST_STATUS'; 

-- Table LOGFILE, version 1
-- Represents log file metadata and content
CREATE TABLE public.logfile ( 
  logf_pk       SERIAL NOT NULL PRIMARY KEY,
  ctst_pk       INTEGER NULL, 
  logf_filename VARCHAR(255) NOT NULL,
  uploaded_ts   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  log_format    VARCHAR(80) DEFAULT 'N/A' NOT NULL,
  callsign      VARCHAR(255),
  category      VARCHAR(255) DEFAULT 'CHECKLOG' NOT NULL,
  email         VARCHAR(120),
  all_headers   JSON,
  note          TEXT, 
  content       TEXT); 
CREATE INDEX x_logf_callsign ON public.logfile USING btree (callsign);
CREATE INDEX x_logf_filename ON public.logfile USING btree (logf_filename);
CREATE INDEX x_logf_upload   ON public.logfile USING btree (uploaded_ts);
ALTER TABLE public.logfile ADD CONSTRAINT fk_logfile_contest 
  FOREIGN KEY ( ctst_pk )
  REFERENCES public.contest( ctst_pk );

ALTER TABLE public.logfile OWNER TO hamtest_owner; 
COMMENT ON TABLE public.logfile IS 'Uploaded log files information'; 
COMMENT ON COLUMN public.logfile.logf_pk IS 'Autogenerated primary key'; 
COMMENT ON COLUMN public.logfile.logf_filename IS 'Uploaded file name'; 
COMMENT ON COLUMN public.logfile.uploaded_ts IS 'File upload time'; 
COMMENT ON COLUMN public.logfile.log_format IS 'Auto-identified log file format'; 
COMMENT ON COLUMN public.logfile.callsign IS 'Logging station call sign'; 
COMMENT ON COLUMN public.logfile.category IS 'Log entry category from the log file'; 
COMMENT ON COLUMN public.logfile.email IS 'E-mail address specified in log file header'; 
COMMENT ON COLUMN public.logfile.all_headers IS 'All headers as JSON object'; 
COMMENT ON COLUMN public.logfile.note IS 'Any remark about log file'; 
COMMENT ON COLUMN public.logfile.ctst_pk IS 'Foreign key to CONTEST'; 
COMMENT ON COLUMN public.logfile.content IS 'All content of the original text file'; 
-- default dummy logfile record for autogenerated QSOs from stations who did not send logs
INSERT INTO logfile (logf_pk, ctst_pk, logf_filename, uploaded_ts, log_format, category )
VALUES (-1, NULL, '*', '2000-01-01T00:00z'::TIMESTAMPTZ, 'NONE', 'DUMMY');

--> Table: public.lograwtext, version 1
--> Contains text lines from the incoming log, one line per row, numbered, ordered
CREATE TABLE public.lograwtext ( 
  lrt_pk   BIGSERIAL PRIMARY KEY,
  ctst_pk  INTEGER NOT NULL,
  logf_pk  INTEGER NOT NULL REFERENCES logfile( logf_pk), 
  linenum  INTEGER NOT NULL DEFAULT 0,
  linetext VARCHAR(255),
  UNIQUE (logf_pk, linenum)
); 
ALTER TABLE public.lograwtext OWNER TO hamtest_owner; 
CREATE INDEX fki_fk_lograwtext_contest ON public.lograwtext USING btree (ctst_pk);
CREATE INDEX fki_fk_lograwtext_logfile ON public.lograwtext USING btree (logf_pk);
ALTER TABLE ONLY public.lograwtext ADD CONSTRAINT fk_lograwtext_contest
  FOREIGN KEY (ctst_pk) REFERENCES public.contest(ctst_pk) MATCH FULL 
  ON DELETE CASCADE;
ALTER TABLE ONLY public.lograwtext ADD CONSTRAINT fk_lograwtext_logfile
  FOREIGN KEY (logf_pk) REFERENCES public.logfile(logf_pk) MATCH FULL 
  ON DELETE CASCADE;
COMMENT ON CONSTRAINT fk_lograwtext_logfile ON public.lograwtext IS 'Foreign key referencing logfile';

COMMENT ON TABLE public.lograwtext IS 'Raw text of the log file'; 
COMMENT ON COLUMN public.lograwtext.logf_pk IS 'Reference to logfile header'; 
COMMENT ON COLUMN public.lograwtext.ctst_pk IS 'Contest key';  
COMMENT ON COLUMN public.lograwtext.linenum IS 'line number in the file'; 
COMMENT ON COLUMN public.lograwtext.linetext IS 'the actual text line'; 

--> Table: public.qso, version 1
--> Parsed QSO record ready for evaluation
CREATE TABLE public.qso ( 
  qso_pk   BIGSERIAL PRIMARY KEY,
  logf_pk  INTEGER NOT NULL,
  ctst_pk  INTEGER NOT NULL,
  qso_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  qso_band VARCHAR(20) NOT NULL,
  qso_mode varchar(20) NOT NULL,
  mode_tx  varchar(20),
  calls    varchar(80) NOT NULL,
  rsts     varchar(10),
  nrs      integer, 
  exc1s    varchar(40),
  exc2s    varchar(40),
  callr    varchar(80) NOT NULL,
  rstr     varchar(10),
  nrr      integer, 
  exc1r    varchar(40),
  exc2r    varchar(40),
  is_ignored   boolean DEFAULT FALSE NOT NULL, 
  is_processed boolean DEFAULT FALSE NOT NULL, 
  is_valid     boolean DEFAULT FALSE NOT NULL, 
  error_type   varchar(80),
  match_qso_pk bigint, 
  points       integer DEFAULT 0 NOT NULL,
  mults        integer DEFAULT 0 NOT NULL,
  source_type  character(1) DEFAULT 'L' NOT NULL,
  linenum      integer DEFAULT 0 NOT NULL
); 

ALTER TABLE public.qso OWNER TO hamtest_owner; 
ALTER TABLE ONLY public.qso 
  ADD CONSTRAINT fk_qso_contest
  FOREIGN KEY (ctst_pk) REFERENCES public.contest(ctst_pk);
ALTER TABLE ONLY public.qso 
  ADD CONSTRAINT fk_qso_logfile
  FOREIGN KEY (logf_pk) REFERENCES public.logfile(logf_pk) ON DELETE CASCADE;

COMMENT ON TABLE public.qso IS 'Table of contacts'; 
COMMENT ON COLUMN public.qso.logf_pk IS 'Reference to log'; 
COMMENT ON COLUMN public.qso.qso_time IS 'QSO date and time as logged (UTC)'; 
COMMENT ON COLUMN public.qso.qso_band IS 'Frequency band as logged'; 
COMMENT ON COLUMN public.qso.qso_mode IS 'QSO mode as logged'; 
COMMENT ON COLUMN public.qso.calls IS 'Logging station callsign (should be same as LOGFILE.CALLSIGN)'; 
COMMENT ON COLUMN public.qso.rsts IS 'RS(T) sent by logging station'; 
COMMENT ON COLUMN public.qso.nrs IS 'Serial number sent by logging station'; 
COMMENT ON COLUMN public.qso.exc1s IS 'Extra exchange 1 sent by logging stations'; 
COMMENT ON COLUMN public.qso.exc2s IS 'Extra exchange 2 sent by logging stations'; 
COMMENT ON COLUMN public.qso.callr IS 'Contacted station callsign'; 
COMMENT ON COLUMN public.qso.rstr IS 'RS(T) received by logging station'; 
COMMENT ON COLUMN public.qso.nrr IS 'Serial number received by logging station'; 
COMMENT ON COLUMN public.qso.exc1r IS 'Extra exchange 1 received by logging station'; 
COMMENT ON COLUMN public.qso.exc2r IS 'Extra exchange 1 received by logging station'; 
COMMENT ON COLUMN public.qso.is_ignored IS 'TRUE indicates that this record must be ignored (not processed)'; 
COMMENT ON COLUMN public.qso.is_processed IS 'TRUE if the record was already processed'; 
COMMENT ON COLUMN public.qso.is_valid IS 'TRUE if the record is confirmed (valid)'; 
COMMENT ON COLUMN public.qso.error_type IS 'Error description if the record is not valid'; 
COMMENT ON COLUMN public.qso.match_qso_pk IS 'Primary key of matching counterparty QSO record if found'; 
COMMENT ON COLUMN public.qso.points IS 'Score for QSO'; 
COMMENT ON COLUMN public.qso.mults IS 'Multipliers in this QSO'; 
COMMENT ON COLUMN public.qso.source_type IS 'L if loaded from log, X if constructed from others'; 
COMMENT ON COLUMN public.qso.linenum IS 'Line number in the source log file'; 

-->> VIEWS
--> View: v_category_power, version 1
-- used to set category in logs from CATEGORY-POWER
-- Cabrillo only
CREATE VIEW public.v_category_power AS
SELECT lt.ctst_pk, lt.logf_pk, lt.linetext,
 regexp_replace((lt.linetext), '^CATEGORY-POWER: ', '') AS catg_power
FROM public.lograwtext lt
WHERE (lt.linetext) ~ '^CATEGORY-POWER: '; 
ALTER VIEW public.v_category_power OWNER TO hamtest_owner; 
COMMENT ON VIEW public.v_category_power 
  IS 'This view returns power category for each log file, based on Cabrillo/3.0 header. Used by procedure.';

--> View: v_parse_qso_cav, version 1
--> Mapping view
--> transforms log file text into QSO record
CREATE VIEW public.v_parse_qso_cav AS 
WITH src AS ( 
  SELECT 
    lograwtext.ctst_pk,
    lograwtext.logf_pk,
    lograwtext.lrt_pk,
    lograwtext.linenum,
    lograwtext.linetext,
    regexp_split_to_array((lograwtext.linetext), '\s+') AS fields
  FROM public.lograwtext
  WHERE (lograwtext.linetext ~ '^QSO:\s+')
)
SELECT 
  src.ctst_pk,
  src.logf_pk,
  src.linenum,
  band.band_id AS qso_band,
  src.fields[3] AS qso_mode,
  (concat(src.fields[4], 'T', substr(src.fields[5], 1, 2), ':', substr(src.fields[5], 3, 2)))::timestamp
    AS qso_time,
  src.fields[6] AS calls,
  src.fields[7] AS rsts,
  CASE
    WHEN (src.fields[8] ~ '^\d+$') THEN btrim(to_char((src.fields[8])::integer, '999000'))
    ELSE src.fields[8]
  END AS exc1s,
  src.fields[9] AS callr,
  src.fields[10] AS rstr,
  CASE
    WHEN (src.fields[11] ~ '^\d+$') THEN btrim(to_char((src.fields[11])::integer, '999000'))
    ELSE src.fields[11]
  END AS exc1r
FROM src
LEFT JOIN public.band 
  ON src.fields[2]::integer between band.freq_khz_low and band.freq_khz_high;
ALTER VIEW public.v_parse_qso_cav OWNER TO hamtest_owner; 
COMMENT ON VIEW public.v_parse_qso_cav 
  IS 'This view maps QSO lines from lograwtext to QSO record based on CAV-TEST template. Used in procedure.';

--> View: public.v_qso_check_rst_exc1
--> Provides evaluation whether the QSO is valid based on comparison of RST and EXC1
--> If received with error, only receiving side has invalid contact
CREATE VIEW public.v_qso_check_rst_exc1 AS
SELECT q1.ctst_pk,
 q1.qso_pk,
 q2.qso_pk AS match_qso_pk,
 q1.qso_time,
 (q2.rsts = q1.rstr) AS rstok,
 (q2.exc1s = q1.exc1r) AS exc1ok,
 (DATE_PART('minutes', (q1.qso_time - q2.qso_time)) between -2 and 2) AS utcok,
 q1.calls,
 q1.rsts AS rsts1,
 q2.rstr AS rstr2,
 q1.exc1s AS exc1s1,
 q2.exc1r AS exc1r2,
 q1.callr,
 q2.rsts AS rsts2,
 q1.rstr AS rstr1,
 q2.exc1s AS exc1s2,
 q1.exc1r AS exc1r1,
 DATE_PART('minutes', (q1.qso_time - q2.qso_time)) AS utc_diff
FROM public.qso q1
JOIN public.qso q2 
ON q2.calls = q1.callr -- same calls on receiving side
  AND q1.calls = q2.callr -- and on transmitting side
  AND q2.ctst_pk = q1.ctst_pk -- and same contest
  AND q1.qso_band = q2.qso_band; -- same band regardless of contest  
ALTER VIEW public.v_qso_check_rst_exc1 OWNER TO hamtest_owner; 
COMMENT ON VIEW v_qso_check_rst_exc1 
  IS 'This view provides validity of contact base on RST, EXC1 and UTC time. Only returns contacts in the same contest and on the same band. Used in procedure. Not yet dupe-safe!';

--> View: V_RESULT_CAV
--> Show results of CAV Contest
CREATE VIEW public.v_result_cav AS
SELECT 
  logfile.ctst_pk,
  logfile.category,
  rank() OVER (
    PARTITION BY logfile.ctst_pk, logfile.category 
    ORDER BY sum(qso.points) DESC, 
      sum(CASE WHEN (qso.qso_time < (contest.utc_from + '00:20:00'::interval)) THEN 1 ELSE 0 END) DESC
    ) AS poradi,
  qso.calls,
  count(*) AS qsos,
  sum(qso.points) AS score,
  sum(CASE WHEN (qso.qso_time < (contest.utc_from + '00:20:00'::interval)) THEN 1 ELSE 0 END) AS score_20min
FROM public.qso
JOIN public.logfile 
  ON logfile.ctst_pk = qso.ctst_pk
    AND logfile.callsign = qso.calls
    AND qso.source_type = 'L'
JOIN public.contest ON contest.ctst_pk = qso.ctst_pk
GROUP BY 
  logfile.ctst_pk,
  logfile.category,
  qso.calls
ORDER BY 
 logfile.ctst_pk,
 logfile.category, 
 sum(qso.points) DESC, 
 sum(CASE WHEN (qso.qso_time < (contest.utc_from + '00:20:00'::interval)) THEN 1 ELSE 0  END) DESC
; 
ALTER VIEW public.v_result_cav OWNER TO hamtest_owner; 

COMMENT ON VIEW public.v_result_cav
IS 'Show results of CAV Contest' ;

