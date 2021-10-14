--
-- Name: proc_delete_log(integer, varchar); Type: PROCEDURE; Schema: public; Owner: postgres
-- Delete logs with the same callsign from contest [p_ctst_pk]
CREATE PROCEDURE public.proc_delete_log(p_ctst_pk integer, p_callsign varchar) LANGUAGE sql AS $$
  delete from qso
  where logf_pk in (select logf_pk from logfile where ctst_pk = p_ctst_pk and callsign = p_callsign);
  delete from lograwtext
  where logf_pk in (select logf_pk from logfile where ctst_pk = p_ctst_pk and callsign = p_callsign);
  delete from logfile
  where ctst_pk = p_ctst_pk and callsign = p_callsign ;
$$;
ALTER PROCEDURE public.proc_delete_log(p_ctst_pk integer, p_callsign varchar) OWNER TO hamtest_owner;

--
-- Name: proc_fix_exc1_numeric(bigint); Type: PROCEDURE; Schema: public; Owner: postgres
-- Normalize numeric EXCHANGE1 [exc1s, exc1r] to three digits left padded with 0 if shorter
CREATE PROCEDURE public.proc_fix_exc1_numeric(p_ctst_pk integer) LANGUAGE sql AS $_$
update QSO set
exc1s =
  case
    when exc1s ~ '^([0-9])$' then regexp_replace(exc1s, '^([0-9])$', '00\1')
    when exc1s ~ '^([0-9]{2})$' then regexp_replace(exc1s, '^([0-9]{2})$', '0\1')
    else exc1s
  end,
 exc1r =
  case
    when exc1r ~ '^([0-9])$' then regexp_replace(exc1r, '^([0-9])$', '00\1')
    when exc1r ~ '^([0-9]{2})$' then regexp_replace(exc1r, '^([0-9]{2})$', '0\1')
    else exc1r
  end
where ctst_pk = p_ctst_pk
  and exc1s ~ '^([0-9]{1,2})$' or exc1r ~ '^([0-9]{1,2})$';
$_$;
ALTER PROCEDURE public.proc_fix_exc1_numeric(p_ctst_pk integer) OWNER TO hamtest_owner;

--
-- Name: proc_gen_unlogged(bigint); Type: PROCEDURE; Schema: public; Owner: postgres
-- Generate artificial QSO records for stations who did not provide their logs
-- Limit is hardcoded to at least 2. If a callsign appears only once, artificial 
-- record is not created. 
CREATE PROCEDURE public.proc_gen_unlogged(p_ctst_pk integer) LANGUAGE sql AS $$
delete from qso
where source_type = 'X' and ctst_pk = p_ctst_pk ;
with missing as (
  select
      qso.callr
      , qso.calls
	  , count(*) over (partition by qso.ctst_pk, qso.callr) as NUM_QSOS
      , qso.rstr
      , qso.exc1r
      , qso.exc2r
      , qso.qso_time
      , qso.qso_band
      , qso.qso_mode
      , 'X' as source_type
      , qso.ctst_pk
      , -1  as logf_pk
  from qso
  left join logfile
    on logfile.ctst_pk = qso.ctst_pk and logfile.callsign = qso.callr
  where qso.match_qso_pk is null and logfile.logf_pk is null
    and qso.ctst_pk = p_ctst_pk and not qso.is_processed
)
insert into qso (
	calls
	, callr
	, rsts
	, exc1s
	, exc2s
	, qso_time
	, qso_band
	, qso_mode
	, source_type
	, ctst_pk
	, logf_pk)
select
	callr
	, calls
	, rstr
	, exc1r
	, exc2r
  	, qso_time
	, qso_band
	, qso_mode
  	, source_type
	, ctst_pk
	, logf_pk
from missing
where missing.num_qsos > 1 ;
$$;
ALTER PROCEDURE public.proc_gen_unlogged(p_ctst_pk integer) OWNER TO hamtest_owner;


--
-- Name: proc_parse_cav(integer, integer); Type: PROCEDURE; Schema: public; Owner: postgres
-- Parses one log [P_LOGF_PK] in contest [P_CTST_PK], or all logs if P_LOGF_PK is null.
-- Parse LOGRAWTEXT lines and generate records in QSO assuming the source is Cabrillo
-- and fields go in order Mycall, RST sent, Exchange sent [-> exc1s],
-- Call, RST received, Exchange received [-> exc1r]
-- new records have POINTS = 0, MULTS = 0, IS_VALID = false, IS_PROCESSED = false
CREATE PROCEDURE public.proc_parse_cav(p_ctst_pk integer, p_logf_pk integer) LANGUAGE sql AS $$
delete from qso where ctst_pk = p_ctst_pk and logf_pk = coalesce( p_logf_pk, logf_pk );
insert into qso (ctst_pk, logf_pk, linenum, qso_band, qso_mode, qso_time,
	   calls, rsts, exc1s,
	   callr, rstr, exc1r,
	   points, mults, is_processed, is_valid )
select ctst_pk, logf_pk, linenum, qso_band, qso_mode, qso_time,
	   calls, rsts, exc1s,
	   callr, rstr, exc1r,
	   0, 0, false, false
from V_PARSE_QSO_CAV
where ctst_pk = p_ctst_pk and logf_pk = coalesce( p_logf_pk, logf_pk );
$$;
ALTER PROCEDURE public.proc_parse_cav(p_ctst_pk integer, p_logf_pk integer) OWNER TO hamtest_owner;

--
-- Name: proc_reset_valuation(bigint); Type: PROCEDURE; Schema: public; Owner: postgres
--
CREATE PROCEDURE public.proc_reset_valuation(p_ctst_pk integer) LANGUAGE sql AS $$
delete from public.qso
where source_type = 'X' and ctst_pk = p_ctst_pk;
update public.qso
set
  is_valid = false,
  is_processed = false,
  points = 0,
  mults = 0,
  match_qso_pk = null
where ctst_pk = p_ctst_pk;
$$;
ALTER PROCEDURE public.proc_reset_valuation(p_ctst_pk integer) OWNER TO hamtest_owner;
COMMENT ON PROCEDURE public.proc_reset_valuation(p_ctst_pk integer) IS 'Invalidate all contacts, reset all points and multipliers';

CREATE PROCEDURE public.proc_set_category_power(p_ctst_pk integer) LANGUAGE sql AS $$
update LOGFILE LF
set CATEGORY = V.CATG_POWER
from V_CATEGORY_POWER V
where LF.CTST_PK = p_ctst_pk and V.CTST_PK = LF.CTST_PK
  and LF.LOGF_PK = V.LOGF_PK
$$;
ALTER PROCEDURE public.proc_set_category_power(p_ctst_pk integer) OWNER TO hamtest_owner;

CREATE PROCEDURE public.proc_split_lines(p_ctst_pk integer) LANGUAGE sql AS $$
delete from lograwtext where ctst_pk = p_ctst_pk ;
insert into lograwtext( ctst_pk, logf_pk, linetext, linenum )
select p_ctst_pk
  , logfile.logf_pk
  , upper(linetext) as linetext
  , linetext.ordinality as linenum
from logfile,
lateral regexp_split_to_table( logfile.content, '\r?\n') with ordinality as linetext
where ctst_pk = p_ctst_pk;
$$;
ALTER PROCEDURE public.proc_split_lines(p_ctst_pk integer) OWNER TO hamtest_owner;

CREATE PROCEDURE public.proc_split_lines_log(p_logf_pk integer) LANGUAGE sql AS $$
delete from lograwtext where logf_pk = p_logf_pk ;
insert into lograwtext( ctst_pk, logf_pk, linetext, linenum )
select logfile.ctst_pk
  , logfile.logf_pk
  , upper(linetext) as linetext
  , linetext.ordinality as linenum
from logfile,
lateral regexp_split_to_table( logfile.content, '\r?\n') with ordinality as linetext
where logfile.logf_pk = p_logf_pk;
$$;
ALTER PROCEDURE public.proc_split_lines_log(p_logf_pk integer) OWNER TO hamtest_owner;
COMMENT ON PROCEDURE public.proc_split_lines_log(p_logf_pk integer) IS 'Process one log file - split text into lines and store in table lograwtext.';

CREATE PROCEDURE public.proc_validate_rst_exc1(p_ctst_pk integer) LANGUAGE sql AS $$
update qso
set
  is_valid = (V.rstok and V.exc1ok and V.utcok),
  is_processed = true,
  points =
    case when (V.rstok and V.exc1ok and V.utcok)
      then case
	      when qso.callr = 'OK5CAV' then 5
		    when qso.exc1r ~ '^CAV' then 2
		    else 1
	    end
	    else 0
    end,
  match_qso_pk = V.match_qso_pk
from (select * from v_qso_check_rst_exc1 ) V
where
qso.ctst_pk = p_ctst_pk and qso.ctst_pk = V.ctst_pk
and not is_processed
and V.match_qso_pk is not null
and qso.qso_pk = V.qso_pk;
$$;
ALTER PROCEDURE public.proc_validate_rst_exc1(p_ctst_pk integer) OWNER TO hamtest_owner;

CREATE PROCEDURE public.wipe_log(p_ctst_pk integer, p_callsign varchar) LANGUAGE sql AS $$
delete from QSO where logf_pk in (select logf_pk from logfile where ctst_pk = p_ctst_pk and callsign = p_callsign);
delete from LOGRAWTEXT where logf_pk in (select logf_pk from logfile where ctst_pk = p_ctst_pk and callsign = p_callsign);
delete from LOGFILE where ctst_pk = p_ctst_pk and callsign = p_callsign ;
$$;

ALTER PROCEDURE public.wipe_log(p_ctst_pk integer, p_callsign varchar) OWNER TO hamtest_owner;

