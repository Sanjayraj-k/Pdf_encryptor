from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import re

app = Flask(__name__)
CORS(app)

JUDGE0_URL = "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true"

headers = {
    "Content-Type": "application/json",
    "X-RapidAPI-Key": "rithik_api_key",  # Your provided Judge0 API key
    "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
}

language_ids = {
    'javascript': 63,  # Node.js
    'python': 71,      # Python 3
    'java': 62,        # Java
    'cpp': 54,         # C++
    'c': 50            # C
}

def wrap_code_with_tests(question_id, code, language, test_cases):
    if question_id == 1:  # Add Two Numbers
        if language == 'javascript':
            return f"""
{code}
console.log(add({test_cases[0][0]}, {test_cases[0][1]}));
"""
        elif language == 'python':
            return f"""
{code}
solution = Solution()
print(solution.add({test_cases[0][0]}, {test_cases[0][1]}))
"""
        elif language == 'java':
            return f"""
{code}
public class Main {{
    public static void main(String[] args) {{
        Solution sol = new Solution();
        System.out.println(sol.add({test_cases[0][0]}, {test_cases[0][1]}));
    }}
}}
"""
        elif language == 'cpp':
            return f"""
{code}
#include <iostream>
int main() {{
    Solution sol;
    std::cout << sol.add({test_cases[0][0]}, {test_cases[0][1]}) << std::endl;
    return 0;
}}
"""
        elif language == 'c':
            return f"""
{code}
#include <stdio.h>
int main() {{
    printf("%d\\n", add({test_cases[0][0]}, {test_cases[0][1]}));
    return 0;
}}
"""
    elif question_id == 2:  # Reverse String
        input_str = test_cases[0][0]
        if language == 'javascript':
            return f"""
{code}
let s = {json.dumps(list(input_str))};
reverseString(s);
console.log(s);
"""
        elif language == 'python':
            return f"""
{code}
solution = Solution()
s = {json.dumps(list(input_str))}
solution.reverseString(s)
print(s)
"""
        elif language == 'java':
            return f"""
{code}
public class Main {{
    public static void main(String[] args) {{
        Solution sol = new Solution();
        char[] s = {json.dumps(input_str).replace('"', "'")}.toCharArray();
        sol.reverseString(s);
        System.out.println(new String(s));
    }}
}}
"""
        elif language == 'cpp':
            return f"""
{code}
#include <iostream>
#include <vector>
int main() {{
    Solution sol;
    std::vector<char> s = {json.dumps(list(input_str)).replace('"', "'")};
    sol.reverseString(s);
    for(char c : s) std::cout << c;
    std::cout << std::endl;
    return 0;
}}
"""
        elif language == 'c':
            return f"""
{code}
#include <stdio.h>
#include <string.h>
int main() {{
    char s[] = {json.dumps(input_str)};
    reverseString(s, strlen(s));
    printf("%s\\n", s);
    return 0;
}}
"""
    elif question_id == 3:  # Two Sum
        nums, target = test_cases[0]
        if language == 'javascript':
            return f"""
{code}
console.log(twoSum({json.dumps(nums)}, {target}));
"""
        elif language == 'python':
            return f"""
{code}
solution = Solution()
print(solution.twoSum({json.dumps(nums)}, {target}))
"""
        elif language == 'java':
            return f"""
{code}
public class Main {{
    public static void main(String[] args) {{
        Solution sol = new Solution();
        int[] nums = {json.dumps(nums)};
        int[] result = sol.twoSum(nums, {target});
        System.out.println("[" + result[0] + "," + result[1] + "]");
    }}
}}
"""
        elif language == 'cpp':
            return f"""
{code}
#include <iostream>
#include <vector>
int main() {{
    Solution sol;
    std::vector<int> nums = {json.dumps(nums)};
    std::vector<int> result = sol.twoSum(nums, {target});
    std::cout << "[" << result[0] << "," << result[1] << "]" << std::endl;
    return 0;
}}
"""
        elif language == 'c':
            return f"""
{code}
#include <stdio.h>
#include <stdlib.h>
int main() {{
    int nums[] = {json.dumps(nums)};
    int target = {test_cases[0][1]};
    int returnSize;
    int* result = twoSum(nums, {len(nums)}, target, &returnSize);
    printf("[%d,%d]\\n", result[0], result[1]);
    free(result);
    return 0;
}}
"""
    return code

@app.route('/run', methods=['POST'])
def run_code():
    data = request.get_json()
    code = data.get('code')
    language = data.get('language')
    question_id = data.get('question_id')
    test_case = data.get('test_case')

    if not all([code, language, question_id]):
        return jsonify({'error': 'Missing required parameters'}), 400

    try:
        if question_id == 1:  # Add Two Numbers
            # Handle test case format like "a = 0, b = undefined" or "0 undefined"
            if test_case:
                # Normalize input: remove "a =", "b =", and commas
                cleaned_test_case = re.sub(r'a\s*=\s*', '', test_case)
                cleaned_test_case = re.sub(r'b\s*=\s*', '', cleaned_test_case)
                cleaned_test_case = cleaned_test_case.replace(',', ' ').strip()
                inputs = cleaned_test_case.split()
                if len(inputs) != 2:
                    return jsonify({'error': 'Invalid test case: Expected two integers'}), 400
                if any(x.lower() in ['undefined', 'null', 'nan'] for x in inputs):
                    return jsonify({'error': 'Invalid test case: Inputs must be integers, not undefined/null/NaN'}), 400
                inputs = [int(x) for x in inputs]
            else:
                inputs = [2, 3]
            test_cases = [(inputs[0], inputs[1])]
            expected = inputs[0] + inputs[1]
        elif question_id == 2:  # Reverse String
            input_str = test_case or "hello"
            if not input_str.isascii():
                return jsonify({'error': 'Invalid test case: Input must be printable ASCII characters'}), 400
            test_cases = [(input_str,)]
            expected = input_str[::-1]
        elif question_id == 3:  # Two Sum
            if test_case:
                parts = test_case.split(', target = ')
                if len(parts) != 2:
                    return jsonify({'error': 'Invalid test case: Expected format "nums = [..], target = .."'}), 400
                nums_str = parts[0].replace('nums = ', '').strip()
                nums = json.loads(nums_str)
                target = int(parts[1])
            else:
                nums = [2, 7, 11, 15]
                target = 9
            test_cases = [(nums, target)]
            expected = [0, 1]  # Default for demo
        else:
            return jsonify({'error': 'Invalid question ID'}), 400
    except ValueError as e:
        return jsonify({'error': f'Invalid test case format: Inputs must be valid integers'}), 400
    except json.JSONDecodeError as e:
        return jsonify({'error': f'Invalid test case format: Invalid JSON for nums array'}), 400
    except Exception as e:
        return jsonify({'error': f'Invalid test case format: {str(e)}'}), 400

    wrapped_code = wrap_code_with_tests(question_id, code, language, test_cases)

    try:
        response = requests.post(JUDGE0_URL, json={
            'source_code': wrapped_code,
            'language_id': language_ids[language],
        }, headers=headers)

        if response.status_code != 200:
            return jsonify({'error': f'Judge0 API error: {response.text}'}), 500

        result = response.json()
        stdout = result.get('stdout', '')
        stderr = result.get('stderr', '')
        compile_output = result.get('compile_output', '')

        output = stdout.strip() if stdout else (compile_output or stderr or "No Output")
        passed = str(output).strip() == str(expected).strip()

        return jsonify({
            'output': f"Test Case:\nInput: {test_case or 'default'}\nOutput: {output}",
            'passed': passed,
            'error': stderr or compile_output
        })
    except Exception as e:
        return jsonify({'error': f'Error executing code: {str(e)}'}), 500

@app.route('/submit', methods=['POST'])
def submit_code():
    data = request.get_json()
    code = data.get('code')
    language = data.get('language')
    question_id = data.get('question_id')

    if not all([code, language, question_id]):
        return jsonify({'error': 'Missing required parameters'}), 400

    test_cases = []
    expected_outputs = []
    if question_id == 1:  # Add Two Numbers
        test_cases = [(2, 3), (-1, 1)]
        expected_outputs = [5, 0]
    elif question_id == 2:  # Reverse String
        test_cases = [("hello",), ("Hannah",)]
        expected_outputs = ["olleh", "hannaH"]
    elif question_id == 3:  # Two Sum
        test_cases = [([2,7,11,15], 9), ([3,2,4], 6)]
        expected_outputs = [[0,1], [1,2]]
    else:
        return jsonify({'error': 'Invalid question ID'}), 400

    results = []
    passed_count = 0

    for i, test_case in enumerate(test_cases):
        wrapped_code = wrap_code_with_tests(question_id, code, language, [test_case])
        
        try:
            response = requests.post(JUDGE0_URL, json={
                'source_code': wrapped_code,
                'language_id': language_ids[language],
            }, headers=headers)

            if response.status_code != 200:
                results.append({
                    'test_case': f"Test Case {i+1}",
                    'error': f"Judge0 API error: {response.text}"
                })
                continue

            result = response.json()
            stdout = result.get('stdout', '')
            stderr = result.get('stderr', '')
            compile_output = result.get('compile_output', '')

            output = stdout.strip() if stdout else (compile_output or stderr or "No Output")
            expected = str(expected_outputs[i]).strip()
            passed = output == expected

            if passed:
                passed_count += 1

            results.append({
                'test_case': f"Test Case {i+1}",
                'input': str(test_case),
                'output': output,
                'expected': expected,
                'passed': passed,
                'error': stderr or compile_output
            })

        except Exception as e:
            results.append({
                'test_case': f"Test Case {i+1}",
                'error': f"Error: {str(e)}"
            })

    return jsonify({
        'results': results,
        'summary': f"{passed_count}/{len(test_cases)} test cases passed",
        'all_passed': passed_count == len(test_cases)
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
