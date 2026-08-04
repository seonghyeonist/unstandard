"""Offline tests for workbook header discovery in the isolated PoC harness."""

from __future__ import annotations

import unittest

from poc_bge_m3 import _find_header_row, _map_headers


class WorkbookHeaderTests(unittest.TestCase):
    def test_specific_text_headers_beat_generic_question_alias(self) -> None:
        headers = (
            "ID",
            "카테고리",
            "질문 레벨",
            "질문 텍스트",
            "답변 텍스트",
            "답변 길이\n(글자)",
            "권장 레이블",
            "권장 경로",
        )

        mapping = _map_headers(headers)

        self.assertEqual(mapping["category"], 1)
        self.assertEqual(mapping["question"], 3)
        self.assertEqual(mapping["answer"], 4)
        self.assertEqual(mapping["answer_length"], 5)
        self.assertEqual(mapping["recommended_label"], 6)
        self.assertEqual(mapping["recommended_path"], 7)

    def test_header_discovery_skips_title_row(self) -> None:
        title = ("UNSTANDARD · Depth Score Labeling Dataset v0.1", None)
        headers = (
            "ID",
            "카테고리",
            "질문 레벨",
            "질문 텍스트",
            "답변 텍스트",
            "답변 길이\n(글자)",
            "권장 레이블",
        )

        row_number, found = _find_header_row(iter((title, headers)))

        self.assertEqual(row_number, 2)
        self.assertEqual(tuple(found), headers)


if __name__ == "__main__":
    unittest.main()
