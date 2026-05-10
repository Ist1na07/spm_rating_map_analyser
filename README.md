# SPM Map Analyser

[English](README_EN.md) | 中文

---

一个 [tosu](https://tosu.app) 游戏内叠加界面，**基于 SPM Rating 算法**为 osu!mania **7K** 谱面提供实时难度评级与键型分析。

## 主要特性

- **实时难度评级**：基于 Sigmoid 聚合模型，使用 S 形准确率曲线模拟玩家表现并求解稳定评级
- **RC / LN 多源估计**：
  - **Total SR**：全谱面综合难度
  - **RC 难度**：仅 Rice 段落（LN 头视为 Tap）
  - **LN 难度**（Hybrid 谱面）：LN 段落掩码聚合，避免 RC 段干扰
- **谱面分类**：决策树自动识别 RC / LN / HB / Mix 四种类型
- **难度曲线**：实时绘制全谱面及 RC/LN 分量难度变化图
- **段位映射**：将 SR 映射到 7K Dan 段位体系（0th Dan ~ Stellium）
- **ML 键型标签**：基于 14 标签决策树模型自动标记键型（speed, tech, chordjack, release 等）
- **多 Mod 支持**：适配倍速、DT/HT/NF 等 Mod

## 使用方法

1. 前往 [Release](https://github.com/SPMRating/spm_rating_map_analyser/releases/latest) 下载。
2. 将文件夹放入 tosu 的 `static` 目录。
3. 启动 tosu，进入 dashboard 即可找到 **SPM Map Analyser** 插件。

## 设置

| 设置项 | 说明 | 默认 |
|-------|------|------|
| Show Skill Breakdown | 显示 stream/jack/tech/chordjack/release 分项评分 | 开 |
| Show Pattern Tags | 显示 ML 判定的键型标签 | 开 |
| Accent Color | 难度数值的主色调 | #ffffff |

## 键型标签

ML 决策树模型自动判定（145 张 7K 人工标注谱面训练）：

**RC 系**: speed, dense chordstream, tech, chordjack, fast chordstream, anchor, minijack, vibro, RC Mix
**LN 系**: LN Mix, release, coordination, density, Hybrid

## 段位参考

基于 28 张 Dan 马拉松谱面回归：

| 段位 | RC SR 阈值 | LN SR 阈值 |
|------|-----------|-----------|
| 0th Dan | < 3.39 | < 3.59 |
| ... | ... | ... |
| 10th Dan | 8.78 | 8.54 |
| Gamma Dan | 9.95 | 9.64 |
| Azimuth Dan | 11.08 | 10.69 |
| Zenith Dan | 12.13 | 11.68 |
| Stellium | 13.19+ | 12.78+ |

## 算法概要

SPM Rating 核心流程：

1. **分量计算**：对每个时间点计算 7 个难度分量 — `Pbar`(Stream)、`Jbar`(Jack)、`Xbar`(Cross)、`Abar`(Anchor)、`Rbar`(Release)、`Sbar`(Shield)、`Vbar`(Inverse)
2. **瞬时难度合成**：非线性组合为逐点难度 D(t)
3. **Sigmoid 聚合**：分段后通过 S 形准确率模型加权求解最终 SR

**RC/LN 模型**：RC 仅用前 4 个分量；LN 完整分量；HB 对 RC/LN 段分别掩码聚合。

## 文件结构

```
├── index.html          # 插件界面
├── spm_algorithm.js    # 核心算法
├── settings.json       # tosu 设置
├── metadata.txt        # 插件元数据
├── dan_constants.json  # 段位常量
├── classifier_constants.json  # 类型分类器
└── tag_classifier.json # ML 键型分类器
```

## 注意事项

1. 仅支持 **7K**（4K/6K 显示不可用）。
2. 难度评级为估计值，仅供参考。
3. ML 键型分类器基于有限标注数据训练，小众键型可能误判。
4. 旧版 osu!stable 谱面（v12 以下）可能解析异常。

## 参考

- [tosu](https://tosu.app) — 运行环境
- [SPM Rating](https://github.com/ESWAT-omamori/SPMRating_v2_pro) — 算法调参代码库
- [osumania_map_analyser](https://github.com/LeoBlackMT/osumania_map_analyser) — tosu 插件架构参考

## License

MIT — 详见 [LICENSE](LICENSE)
