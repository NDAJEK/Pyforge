/* ============================================================
   编程题题库（浏览器内用 Brython 运行 CPython 语义的代码）
   字段：in 为每次 input() 的返回值列表，out 为期望的标准输出
   ============================================================ */
window.CODING = [

{
  id: "c01", no: "题 1", type: "基本操作题", score: 15,
  title: "字符分类统计",
  desc: "输入一行字符串，统计其中大写字母、小写字母、数字、其他字符的个数，用空格分隔输出。\n\n提示：字符串的 isupper() / islower() / isdigit() 方法可以直接判断字符类型。",
  sample: "输入：Hello World 2024!\n输出：2 8 4 3",
  starter: "s = input()\nupper = lower = digit = other = 0\n\nfor ch in s:\n    if ch.isupper():\n        upper += 1\n    elif ch.islower():\n        # 在这里补全\n        pass\n    elif ch.isdigit():\n        # 在这里补全\n        pass\n    else:\n        # 在这里补全\n        pass\n\nprint(upper, lower, digit, other)",
  solution: "s = input()\nupper = lower = digit = other = 0\nfor ch in s:\n    if ch.isupper():\n        upper += 1\n    elif ch.islower():\n        lower += 1\n    elif ch.isdigit():\n        digit += 1\n    else:\n        other += 1\nprint(upper, lower, digit, other)",
  tests: [
    { in: ["Hello World 2024!"], out: "2 8 4 3" },
    { in: ["abc"], out: "0 3 0 0" },
    { in: ["ABC123"], out: "3 0 3 0" }
  ]
},

{
  id: "c02", no: "题 2", type: "基本操作题", score: 15,
  title: "最大最小平均值",
  desc: "输入一行用空格分隔的整数，输出其中的最大值、最小值、平均值，平均值保留两位小数，三者用空格分隔。\n\n提示：input().split() 得到字符串列表，用列表推导转成整数；格式化用 '{:.2f}'.format(x)。",
  sample: "输入：3 1 4 1 5\n输出：5 1 2.80",
  starter: "nums = [int(x) for x in input().split()]\n\n# 求最大值、最小值、平均值\nmx = ____\nmn = ____\navg = ____\n\nprint(mx, mn, '{:.2f}'.format(avg))",
  solution: "nums = [int(x) for x in input().split()]\nmx = max(nums)\nmn = min(nums)\navg = sum(nums) / len(nums)\nprint(mx, mn, '{:.2f}'.format(avg))",
  tests: [
    { in: ["3 1 4 1 5"], out: "5 1 2.80" },
    { in: ["10"], out: "10 10 10.00" },
    { in: ["-2 -8 0"], out: "0 -8 -3.33" }
  ]
},

{
  id: "c03", no: "题 3", type: "简单应用题", score: 12,
  title: "输出指定范围内的素数",
  desc: "输入一个正整数 n（n ≥ 2），输出 2 到 n 之间的所有素数，用空格分隔。若没有则输出空行。\n\n提示：写一个 is_prime(x) 函数，从 2 试除到 int(x ** 0.5) 即可。",
  sample: "输入：20\n输出：2 3 5 7 11 13 17 19",
  starter: "n = int(input())\n\ndef is_prime(x):\n    if x < 2:\n        return False\n    # 补全判断逻辑\n    return True\n\nresult = [str(i) for i in range(2, n + 1) if is_prime(i)]\nprint(' '.join(result))",
  solution: "n = int(input())\n\ndef is_prime(x):\n    if x < 2:\n        return False\n    i = 2\n    while i * i <= x:\n        if x % i == 0:\n            return False\n        i += 1\n    return True\n\nresult = [str(i) for i in range(2, n + 1) if is_prime(i)]\nprint(' '.join(result))",
  tests: [
    { in: ["20"], out: "2 3 5 7 11 13 17 19" },
    { in: ["2"], out: "2" },
    { in: ["10"], out: "2 3 5 7" }
  ]
},

{
  id: "c04", no: "题 4", type: "简单应用题", score: 13,
  title: "单词词频统计",
  desc: "输入一行英文句子，统计每个单词出现的次数。按次数从高到低输出，次数相同的按单词字典序升序，格式为「单词:次数」，每行一个。\n\n提示：d.get(w, 0) 累加计数；排序 key 用 lambda 返回 (-次数, 单词)。",
  sample: "输入：the cat and the dog and the bird\n输出：\nthe:3\nand:2\nbird:1\ncat:1\ndog:1",
  starter: "s = input().lower()\nwords = s.split()\n\nd = {}\nfor w in words:\n    # 统计词频\n    pass\n\n# 按次数降序、同次数按单词升序排序后输出\n",
  solution: "s = input().lower()\nwords = s.split()\nd = {}\nfor w in words:\n    d[w] = d.get(w, 0) + 1\n\nfor w, c in sorted(d.items(), key=lambda kv: (-kv[1], kv[0])):\n    print('{}:{}'.format(w, c))",
  tests: [
    { in: ["the cat and the dog and the bird"], out: "the:3\nand:2\nbird:1\ncat:1\ndog:1" },
    { in: ["a a a"], out: "a:3" }
  ]
},

{
  id: "c05", no: "题 5", type: "简单应用题", score: 12,
  title: "斐波那契数列",
  desc: "输入正整数 n，输出斐波那契数列的前 n 项（从 1, 1 开始），用空格分隔。\n\n提示：用 a, b = b, a + b 可以不用临时变量完成递推。",
  sample: "输入：10\n输出：1 1 2 3 5 8 13 21 34 55",
  starter: "n = int(input())\nresult = []\na, b = 1, 1\n\nfor i in range(n):\n    # 把当前项加入 result，并推进 a、b\n    pass\n\nprint(' '.join(str(x) for x in result))",
  solution: "n = int(input())\nresult = []\na, b = 1, 1\nfor i in range(n):\n    result.append(a)\n    a, b = b, a + b\nprint(' '.join(str(x) for x in result))",
  tests: [
    { in: ["10"], out: "1 1 2 3 5 8 13 21 34 55" },
    { in: ["1"], out: "1" },
    { in: ["5"], out: "1 1 2 3 5" }
  ]
},

{
  id: "c06", no: "题 6", type: "简单应用题", score: 13,
  title: "字符串处理：回文判断",
  desc: "输入一行字符串，忽略大小写和空格后判断是否为回文。是则输出 YES，否则输出 NO；随后输出该字符串反转后的结果（保留原样，含空格）。\n\n例如「A man a plan」反转后是「nalp a nam A」。\n\n提示：用 replace(' ', '') 去空格、lower() 转小写、s[::-1] 反转。",
  sample: "输入：Level\n输出：YES\nleveL",
  starter: "s = input()\n\nt = s.replace(' ', '').lower()\n# 判断 t 是否为回文\n\nprint('YES' if ____ else 'NO')\nprint(s[::-1])",
  solution: "s = input()\nt = s.replace(' ', '').lower()\nprint('YES' if t == t[::-1] else 'NO')\nprint(s[::-1])",
  tests: [
    { in: ["Level"], out: "YES\nleveL" },
    { in: ["hello"], out: "NO\nolleh" },
    { in: ["A man a plan"], out: "NO\nnalp a nam A" }
  ]
},

{
  id: "c07", no: "题 7", type: "综合应用题", score: 20,
  title: "成绩统计与排序",
  desc: "第一行输入人数 n，随后 n 行每行是「姓名 成绩」。\n输出：\n第一行：平均分（保留两位小数）\n第二行：最高分姓名和成绩（并列时取先出现的）\n之后每行：按成绩降序输出「姓名:成绩」，成绩相同按姓名升序\n\n提示：把每行 split() 成 [姓名, 分数]；排序 key 用 lambda 返回 (-分数, 姓名)。",
  sample: "输入：\n3\n张三 85\n李四 92\n王五 78\n\n输出：\n85.00\n李四 92\n李四:92\n张三:85\n王五:78",
  starter: "n = int(input())\nstudents = []\n\nfor i in range(n):\n    line = input().split()\n    name, score = line[0], int(line[1])\n    students.append((name, score))\n\ntotal = sum(s for _, s in students)\nprint('{:.2f}'.format(total / n))\n\n# 找最高分（并列取先出现的）\nbest = students[0]\nfor st in students:\n    if ____:\n        best = st\nprint(best[0], best[1])\n\n# 按成绩降序、同分按姓名升序输出\nfor name, score in sorted(students, key=lambda x: (-x[1], x[0])):\n    print('{}:{}'.format(name, score))",
  solution: "n = int(input())\nstudents = []\nfor i in range(n):\n    line = input().split()\n    students.append((line[0], int(line[1])))\n\ntotal = sum(s for _, s in students)\nprint('{:.2f}'.format(total / n))\n\nbest = students[0]\nfor st in students:\n    if st[1] > best[1]:\n        best = st\nprint(best[0], best[1])\n\nfor name, score in sorted(students, key=lambda x: (-x[1], x[0])):\n    print('{}:{}'.format(name, score))",
  tests: [
    { in: ["3", "张三 85", "李四 92", "王五 78"], out: "85.00\n李四 92\n李四:92\n张三:85\n王五:78" },
    { in: ["2", "Tom 90", "Amy 90"], out: "90.00\nTom 90\nAmy:90\nTom:90" }
  ]
},

{
  id: "c08", no: "题 8", type: "综合应用题", score: 20,
  title: "数据去重与频次输出",
  desc: "第一行输入整数个数 n，第二行输入 n 个用空格分隔的整数。\n输出两行：\n第一行：去重后按升序排列的所有数字，空格分隔\n第二行：每个数字及其出现次数，格式「数字:次数」，按数字升序，空格分隔\n\n提示：集合可以自动去重，sorted() 排序，count() 计数。",
  sample: "输入：\n8\n3 1 4 1 5 9 2 6\n\n输出：\n1 2 3 4 5 6 9\n1:2 2:1 3:1 4:1 5:1 6:1 9:1",
  starter: "n = int(input())\nnums = [int(x) for x in input().split()]\n\nunique = sorted(set(nums))\nprint(' '.join(str(x) for x in unique))\n\nparts = []\nfor x in unique:\n    # 追加 '数字:次数'\n    pass\nprint(' '.join(parts))",
  solution: "n = int(input())\nnums = [int(x) for x in input().split()]\nunique = sorted(set(nums))\nprint(' '.join(str(x) for x in unique))\nparts = []\nfor x in unique:\n    parts.append('{}:{}'.format(x, nums.count(x)))\nprint(' '.join(parts))",
  tests: [
    { in: ["8", "3 1 4 1 5 9 2 6"], out: "1 2 3 4 5 6 9\n1:2 2:1 3:1 4:1 5:1 6:1 9:1" },
    { in: ["3", "5 5 5"], out: "5\n5:3" }
  ]
}
];
