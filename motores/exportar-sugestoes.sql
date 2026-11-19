-- Exporta sugestões de cClassTrib por NCM/NBS da base oficial (calculadora-pro.db)
-- para JSON: {"ncm":{codigo:[opcao]},"nbs":{...},"excecoes":{"ncm":{codigo:[cClassTrib]},"nbs":{...}},"padrao":opcao}.
-- Uso: sqlite3 -noheader calculadora-pro.db < exportar-sugestoes.sql > sugestoes-classificacao.json
-- Opção = {cst, cClassTrib, descricao, reducaoCbs, reducaoIbs} (percentuais como string decimal).
-- Filtros de vigência e junção de tributo espelham TratamentoClassificacaoRepository
-- .consultarTratamentoClassificacaoCbsIbs do motor (CBS = TBTO 2; redução CBS = PERE_TBTO 2,
-- IBS = PERE_TBTO 3 [IBSUF]; a redução do IBSMun é igual à do IBSUF nas classificações oficiais).
-- Data de referência: 2027-01-01 (início da cobrança de CBS/IBS).

WITH ref(d) AS (SELECT '2027-01-01'),
cls AS (
  SELECT ct.CLTR_ID AS id,
         st.SITR_CD AS cst,
         ct.CLTR_CD AS cClassTrib,
         ct.CLTR_DESCRICAO AS descricao,
         COALESCE((SELECT MAX(p.PERE_VALOR) FROM PERCENTUAL_REDUCAO p, ref
                    WHERE p.PERE_CLTR_ID = ct.CLTR_ID AND p.PERE_TBTO_ID = 2
                      AND ref.d BETWEEN p.PERE_INICIO_VIGENCIA AND COALESCE(p.PERE_FIM_VIGENCIA, ref.d)), 0) AS rCbs,
         COALESCE((SELECT MAX(p.PERE_VALOR) FROM PERCENTUAL_REDUCAO p, ref
                    WHERE p.PERE_CLTR_ID = ct.CLTR_ID AND p.PERE_TBTO_ID = 3
                      AND ref.d BETWEEN p.PERE_INICIO_VIGENCIA AND COALESCE(p.PERE_FIM_VIGENCIA, ref.d)), 0) AS rIbs
    FROM CLASSIFICACAO_TRIBUTARIA ct, ref
    JOIN SITUACAO_TRIBUTARIA st ON st.SITR_ID = ct.CLTR_SITR_ID
   WHERE ref.d BETWEEN ct.CLTR_INICIO_VIGENCIA AND COALESCE(ct.CLTR_FIM_VIGENCIA, ref.d)
     AND ref.d BETWEEN st.SITR_INICIO_VIGENCIA AND COALESCE(st.SITR_FIM_VIGENCIA, ref.d)
     AND EXISTS (SELECT 1 FROM TRIBUTO_SITUACAO_TRIBUTARIA t
                  WHERE t.TRST_SITR_ID = st.SITR_ID AND t.TRST_TBTO_ID = 2
                    AND ref.d BETWEEN t.TRST_INICIO_VIGENCIA AND COALESCE(t.TRST_FIM_VIGENCIA, ref.d))
     -- como o motor: exige tratamento vigente (TRATAMENTO_CLASSIFICACAO + TRATAMENTO_TRIBUTARIO)
     AND EXISTS (SELECT 1 FROM TRATAMENTO_CLASSIFICACAO tc
                   JOIN TRATAMENTO_TRIBUTARIO tt ON tt.TRTR_ID = tc.TRCL_TRTR_ID
                  WHERE tc.TRCL_CLTR_ID = ct.CLTR_ID
                    AND ref.d BETWEEN tc.TRCL_INICIO_VIGENCIA AND COALESCE(tc.TRCL_FIM_VIGENCIA, ref.d)
                    AND ref.d BETWEEN tt.TRTR_INICIO_VIGENCIA AND COALESCE(tt.TRTR_FIM_VIGENCIA, ref.d))
),
ncm AS (
  SELECT a.NCMA_NCM_CD AS codigo, c.cst, c.cClassTrib, c.descricao, c.rCbs, c.rIbs
    FROM NCM_APLICAVEL a, ref JOIN cls c ON c.id = a.NCMA_CLTR_ID
   WHERE ref.d BETWEEN a.NCMA_INICIO_VIGENCIA AND COALESCE(a.NCMA_FIM_VIGENCIA, ref.d)
   GROUP BY a.NCMA_NCM_CD, c.cClassTrib
),
nbs AS (
  SELECT a.NBSA_NBS_CD AS codigo, c.cst, c.cClassTrib, c.descricao, c.rCbs, c.rIbs
    FROM NBS_APLICAVEL a, ref JOIN cls c ON c.id = a.NBSA_CLTR_ID
   WHERE ref.d BETWEEN a.NBSA_INICIO_VIGENCIA AND COALESCE(a.NBSA_FIM_VIGENCIA, ref.d)
   GROUP BY a.NBSA_NBS_CD, c.cClassTrib
),
-- Exceções: código (NCM/NBS) excetuado -> cClassTrib da linha aplicável que NÃO vale para ele.
-- O código pode ser prefixo (posição/subposição); o consumidor casa por prefixo.
exc_ncm AS (
  SELECT e.ENCM_NCM_CD AS codigo, c.cClassTrib
    FROM EXCECAO_NCM_APLICAVEL e, ref
    JOIN NCM_APLICAVEL a ON a.NCMA_ID = e.ENCM_NCMA_ID
    JOIN cls c ON c.id = a.NCMA_CLTR_ID
   WHERE ref.d BETWEEN e.ENCM_INICIO_VIGENCIA AND COALESCE(e.ENCM_FIM_VIGENCIA, ref.d)
     AND ref.d BETWEEN a.NCMA_INICIO_VIGENCIA AND COALESCE(a.NCMA_FIM_VIGENCIA, ref.d)
   GROUP BY e.ENCM_NCM_CD, c.cClassTrib
),
exc_nbs AS (
  SELECT e.ENBS_NBS_CD AS codigo, c.cClassTrib
    FROM EXCECAO_NBS_APLICAVEL e, ref
    JOIN NBS_APLICAVEL a ON a.NBSA_ID = e.ENBS_NBSA_ID
    JOIN cls c ON c.id = a.NBSA_CLTR_ID
   WHERE ref.d BETWEEN e.ENBS_INICIO_VIGENCIA AND COALESCE(e.ENBS_FIM_VIGENCIA, ref.d)
     AND ref.d BETWEEN a.NBSA_INICIO_VIGENCIA AND COALESCE(a.NBSA_FIM_VIGENCIA, ref.d)
   GROUP BY e.ENBS_NBS_CD, c.cClassTrib
)
SELECT json_object(
  'ncm', (SELECT COALESCE(json_group_object(codigo, json(ops)), json_object()) FROM (
            SELECT codigo, json_group_array(json_object('cst', cst, 'cClassTrib', cClassTrib,
                   'descricao', descricao, 'reducaoCbs', CAST(rCbs AS TEXT), 'reducaoIbs', CAST(rIbs AS TEXT))) AS ops
              FROM (SELECT * FROM ncm ORDER BY codigo, cClassTrib) GROUP BY codigo)),
  'nbs', (SELECT COALESCE(json_group_object(codigo, json(ops)), json_object()) FROM (
            SELECT codigo, json_group_array(json_object('cst', cst, 'cClassTrib', cClassTrib,
                   'descricao', descricao, 'reducaoCbs', CAST(rCbs AS TEXT), 'reducaoIbs', CAST(rIbs AS TEXT))) AS ops
              FROM (SELECT * FROM nbs ORDER BY codigo, cClassTrib) GROUP BY codigo)),
  'excecoes', json_object(
    'ncm', (SELECT COALESCE(json_group_object(codigo, json(l)), json_object()) FROM (
              SELECT codigo, json_group_array(cClassTrib) AS l FROM (SELECT * FROM exc_ncm ORDER BY codigo, cClassTrib) GROUP BY codigo)),
    'nbs', (SELECT COALESCE(json_group_object(codigo, json(l)), json_object()) FROM (
              SELECT codigo, json_group_array(cClassTrib) AS l FROM (SELECT * FROM exc_nbs ORDER BY codigo, cClassTrib) GROUP BY codigo))),
  'padrao', (SELECT json_object('cst', cst, 'cClassTrib', cClassTrib, 'descricao', descricao,
                    'reducaoCbs', CAST(rCbs AS TEXT), 'reducaoIbs', CAST(rIbs AS TEXT))
               FROM cls WHERE cClassTrib = '000001')
);
