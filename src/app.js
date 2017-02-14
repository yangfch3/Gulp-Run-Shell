"use strict";

const path = require('path');
const fs = require('fs-extra');
const childProcess = require('child_process');
const _ = require('lodash');
const shell = electron.shell;
const ipcRender = electron.ipcRenderer;
const Common = require(path.join(__dirname, './src/common'));
const mainProcess = remote.process;

// 变量声明
let $wrapper = $('#wrapper');
let $welcomeStage = $('#welcomeStage');
let $openProject = $('#openProject');
let $projectStage = $('#projectStage');
let $projectList = $('#projectList');
let $installButton = $('#installButton');
let $gulpButton = $('#gulpButton');
// let $mergeButton = $('#mergeButton');
let $cleanButton = $('#cleanButton');
let $delProject = $('#delProject');
let $operationStage = $('#operationStage');
let $logContent = $('#log');
let $cleanLog = $('#cleanLog');
// let $closeSettingButton = $('#closeSetting');
// let $showSettingButton = $('#showSetting');
// let $settingStage = $('#settingStage');
// let $settingStageMask = $('#settingStageMask');
let $toolbar = $('#toolbar');
let $curProject = null;
let finderTitle = Common.PLATFORM === 'win32' ? '打开项目文件夹' : '打开项目目录';
let closeGulpManually = false;
let justInitStatusBar = true;
let localGulpBin = Common.PLATFORM === 'win32' ? '.\node_modules\.bin\gulp.cmd' : './node_modules/.bin/gulp';

ipcRender.on('message', function(event){
     event.send('dd')
});

// 输出平台相关的标识 class
if (Common.PLATFORM === 'win32') {
  $wrapper.addClass('qw_windows');
} else {
  $wrapper.addClass('qw_macOS');
}

// 状态栏
if (Common.PLATFORM === 'win32') {
  // Windows 下处理，需要调换最小化按钮和最大化按钮的位置，配合 Windows 上的习惯
  togglePostion($('.js_statusBar_min'), $('.js_statusBar_max'));
} else {
  // Mac 下处理，hover 时所有状态栏按钮显示 icon
  $('#statusBar_inner').hover(
    function() {
      $('.frame_statusBar_btn').addClass('frame_statusBar_btn_Hover');
    }, function() {
      $('.frame_statusBar_btn').removeClass('frame_statusBar_btn_Hover');
    }
  );
}

$('.js_statusBar_min').on('click', function() {
  remote.BrowserWindow.getFocusedWindow().minimize();
});

$('.js_statusBar_max').on('click', function() {
  const focusedWindow = remote.BrowserWindow.getFocusedWindow();
  // 因为每次打开 App 时，isMaximizable 都会为 true，但实际上窗口并没有最大化，因此加入一个标志位判断是否刚刚打开 App
  if (focusedWindow.isMaximizable() && !justInitStatusBar) {
    focusedWindow.unmaximize();
    focusedWindow.setMaximizable(false);
    $(this).removeClass('frame_statusBar_btn_Unmax');
  } else {
    justInitStatusBar = false;
    focusedWindow.maximize();
    focusedWindow.setMaximizable(true);
    $(this).addClass('frame_statusBar_btn_Unmax');
  }
});

$('.js_statusBar_close').on('click', function() {
  remote.BrowserWindow.getFocusedWindow().close();
});

// 禁止缩放
electron.webFrame.setZoomLevelLimits(1, 1);

// 初始化
init();

// 如果是第一次打开,设置数据并存储
// 其他则直接初始化数据
function init() {

  let storage = Common.getLocalStorage();

  if (!storage) {
    storage = {};
    storage.name = Common.NAME;
    storage['setting'] = {};
    storage['setting']['gulp'] = {};
    storage['setting']['gulp']['notification'] = 'true';
    storage['setting']['gulp']['statusIcon'] = 'true';

    let workspace = path.join(remote.app.getPath(Common.DEFAULT_PATH), Common.WORKSPACE);

    storage.workspace = workspace;
    Common.setLocalStorage(storage)
  } else {
    $projectStage.removeClass('qw_hide');
    $operationStage.removeClass('qw_hide');
    $welcomeStage.addClass('qw_hide');
    $toolbar.removeClass('frame_toolbar_EmptyProject');
    initData();
  }
}

// 初始化数据
function initData() {
    let storage = Common.getLocalStorage();

    if (storage) {

        if (!_.isEmpty(storage['projects'])) {
            let html = '';

            for (let key in storage['projects']) {

                html += `<li class="project_stage_item js_project_item" data-project="${key}" data-name="${storage['projects'][key]['name']}" title="${storage['projects'][key]['path']}">
                          <a class="qw_icon qw_icon_Folder js_openFolder" href="javascript:;" title="${finderTitle}"></a>
                          <div class="project_stage_item_cnt">
                            <div class="project_stage_item_title">${storage['projects'][key]['name']} (${key})</div>
                            <div class="project_stage_item_path">${storage['projects'][key]['path']}</div>
                          </div>
                        </li>`;
            }

            $projectList.html(html);

            // 当前活动项目
            $curProject = $projectList.find('.js_project_item').eq(0);
            $curProject.addClass('project_stage_item_Current');

            let projectPath = $curProject.attr('title');
            // 由 QMUI 的路径修正
            let qmuiModulePath = projectPath + '/node_modules';
            if (!fs.existsSync(qmuiModulePath)) {
              $gulpButton.addClass('qw_hide');
              $cleanButton.addClass('qw_hide');
              $installButton.removeClass('qw_hide');
            } else {
              $gulpButton.removeClass('qw_hide');
              $cleanButton.removeClass('qw_hide');
              $installButton.addClass('qw_hide');
            }

            // 复制一份数据到 sessionStorage，方便后续使用
            Common.setSessionStorage(storage);

        } else {
            $welcomeStage.removeClass('qw_hide');
            $projectStage.addClass('qw_hide');
            $operationStage.addClass('qw_hide');
            $toolbar.addClass('frame_toolbar_EmptyProject');
        }
    }
}

// 不需要 compass 设置功能了
// function initSetting() {
//   // 设置界面处理
//   let storage = Common.getLocalStorage();

//   if (!_.isEmpty(storage['setting'])) {
//     if (storage['setting']['compass']['notification'] === 'true') {
//       let $compassNotification = $('#compass_notification');
//       $compassNotification.attr('checked', true);
//     }
//     if (storage['setting']['compass']['statusIcon'] === 'true') {
//       let $compassStatusIcon = $('#compass_statusIcon');
//       $compassStatusIcon.attr('checked', true);
//     }
//   }
// }


// 打开项目
$openProject.on('change', function () {
    if (this && this.files.length) {
        let projectPath = this.files[0].path;

        openProject(projectPath);

    } else {
        alert('选择目录出错,请重新选择!');
    }
    // 每次选择后清空 value，避免下次选择同一个目录时不触发 change
    $openProject.val('');
});

// 拖曳放置项目
$wrapper[0].ondragover = function () {
  $(this).addClass('frame_wrap_Draging');
  return false;
};
$wrapper[0].ondragleave = $wrapper[0].ondragend = function () {
  $(this).removeClass('frame_wrap_Draging');
  return false;
};
$wrapper[0].ondrop = function (e) {
  e.preventDefault();

  $(this).removeClass('frame_wrap_Draging');

  var file = e.dataTransfer.files[0];

  var stat = fs.statSync(file.path);
  if (stat.isDirectory()) {
    openProject(file.path);
  }
  return false;
};

function openProject(projectPath) {

  let projectDir = path.basename(projectPath);
  let storage = Common.getLocalStorage();
  let projectInfo;
  try {
    projectInfo = require(projectPath + '/config.js');
  } catch(event) {
    try {
      projectInfo = require(projectPath + '/config.json');
    } catch(e) {
      alert('在项目根目录下没有找到 config.js/json');
    }
  }
  if (!projectInfo) {
    return;
  }

  if (storage && storage['workspace']) {
    if (!storage['projects']) {
      storage['projects'] = {};
    }

    if (storage['projects'][projectDir]) {
      alert('项目已存在');
    } else {
      storage['projects'][projectDir] = {};
      storage['projects'][projectDir]['path'] = projectPath;
      Common.setLocalStorage(storage);

      // 插入打开的项目
      insertOpenProject(projectPath);
    }
  }

}

// 插入打开的项目
function insertOpenProject(projectPath) {

  if (!$welcomeStage.hasClass('qw_hide')) {
    $welcomeStage.addClass('qw_hide');
    $projectStage.removeClass('qw_hide');
    $operationStage.removeClass('qw_hide');
    $toolbar.removeClass('frame_toolbar_EmptyProject');
  }

  // 插入节点
  let projectDir = path.basename(projectPath);
  let projectInfo;
  try {
    projectInfo = require(projectPath + '/config.js');
  } catch(event) {
    try {
      projectInfo = require(projectPath + '/config.json');
    } catch(e) {
      alert('在项目根目录下没有找到 config.js/json');
    }
  }
  console.log(projectInfo);
  let projectName = projectInfo.project;

  let $projectHtml = $(`<li class="project_stage_item js_project_item" data-project="${projectDir}" data-name="${projectName}" title="${projectPath}">
      <a class="qw_icon qw_icon_Folder js_openFolder" href="javascript:;" title="${finderTitle}"></a>
      <div class="project_stage_item_cnt">
        <div class="project_stage_item_title">${projectName} (${projectDir})</div>
        <div class="project_stage_item_path">${projectPath}</div>
      </div>
      </li>`);

  $projectList.append($projectHtml);

  $projectList.scrollTop($projectList.get(0).scrollHeight);

  // 只有在节点成功插入了才保存进 storage
  let storage = Common.getLocalStorage();

  if (storage) {
    if (!storage['projects']) {
      storage['projects'] = {};
    }
    if (!storage['projects'][projectDir]) {
      storage['projects'][projectDir] = {};
    }

    storage['projects'][projectDir]['name'] = projectName;
    storage['projects'][projectDir]['path'] = projectPath;
    storage['projects'][projectDir]['log'] = '';

    Common.setLocalStorage(storage);
    // 同步更新 sessionStorage，方便后续使用
    Common.setSessionStorage(storage);
  }

  $projectHtml.trigger('click');
}

// 删除项目
$delProject.on('click', function () {
  let projectDir = $curProject.data('project');
  let projectName = $curProject.data('name');
  $.prompt('删除项目不会影响项目文件，只会把项目从本项目列表中移除。', {
    title: '确认删除 ' + projectName + ' (' + projectDir + ')',
    buttons: { '确认': true, '取消': false },
    submit: function(e,v,m,f) {
      if (v) {
        delProject();
      }
    }
  });
});

function delProject(cb) {

  if (!$curProject.length) {
    return;
  }

  let projectDir = $curProject.data('project');
  let index = $curProject.index();

  $curProject.remove();

  if (index > 0) {
    $curProject = $('.project_stage_item').eq(index - 1);
  } else {
    $curProject = $('.project_stage_item').eq(index);
  }

  $curProject.trigger('click');

  killChildProcess(projectDir);

  let storage = Common.getLocalStorage();

  if (storage && storage['projects'] && storage['projects'][projectDir]) {
    delete storage['projects'][projectDir];
    Common.setLocalStorage(storage);
  }

  if (_.isEmpty(storage['projects'])) {
    $welcomeStage.removeClass('qw_hide');
    $projectStage.addClass('qw_hide');
    $operationStage.addClass('qw_hide');
    $toolbar.addClass('frame_toolbar_EmptyProject');
  }

  console.log('Delete project success.');

  cb && cb();
}

// 清除 log 信息
$cleanLog.on('click', function () {
  // 清空 Log 界面
  $logContent.html('');
  // 清空 Storage
  let projectDir = $curProject.data('project');
  let sessionStorage = Common.getSessionStorage();
  sessionStorage['projects'][projectDir]['log'] = '';
  Common.setSessionStorage(sessionStorage);
});

// 项目列表绑定点击事件
$projectList.on('click', '.js_project_item', function () {
  let $this = $(this);
  $('.js_project_item').removeClass('project_stage_item_Current');
  $this.addClass('project_stage_item_Current');
  $curProject = $this;

  // 检测当前项目是否有安装依赖包
  let projectPath = $curProject.attr('title');
  let modulePath = projectPath + '/node_modules';
  if (!fs.existsSync(modulePath)) {
    $gulpButton.addClass('qw_hide');
    $cleanButton.addClass('qw_hide');
    $installButton.removeClass('qw_hide');
  } else {
    $gulpButton.removeClass('qw_hide');
    $cleanButton.removeClass('qw_hide');
    $installButton.addClass('qw_hide');

    // 根据是否开启了服务设置 Gulp 按钮的状态
    if ($this.data('default')) {
      setGulpBtnWatching();
    } else {
      setGulpBtnNormal();
    }
    // 根据是否正在安装依赖包设置 Install 按钮的状态
    if ($this.data('install')) {
      setInstallBtnInstalling();
    } else {
      setInstallBtnNormal();
    }
  }

  // log 切换
  let projectDir = $curProject.data('project');
  let sessionStorage = Common.getSessionStorage();
  let logData = sessionStorage['projects'][projectDir]['log'];
  logData = logData ? logData : '';
  $logContent.html(`${logData}`);
  $logContent.scrollTop($logContent.get(0).scrollHeight);
});

// 在 item 中打开项目文件夹
$projectList.on('click', '.js_openFolder', function () {
  let $this = $(this);
  let projectPath = $this.parents('.js_project_item').attr('title');

  if (projectPath) {
    shell.showItemInFolder(projectPath);
  }
});

function setGulpBtnNormal() {
  $gulpButton.removeClass('frame_toolbar_btn_Watching');
  $cleanButton.removeClass('qw_hide');
  $gulpButton.text('开启 Gulp 服务');

  $curProject.removeClass('project_stage_item_Watching');
  $curProject.data('default', false);
}

function setGulpBtnWatching() {
  $gulpButton.addClass('frame_toolbar_btn_Watching');
  // 运行 gulp 服务时关闭清理文件的功能，防止误点而使 gulp 停止运行
  $cleanButton.addClass('qw_hide');
  $gulpButton.text('Gulp 正在服务');

  $curProject.addClass('project_stage_item_Watching');
  $curProject.data('default', true);
}

function setInstallBtnNormal() {
  $installButton.removeClass('frame_toolbar_btn_Disabled');

  $curProject.data('install', false);
}

function setInstallBtnInstalling() {
  $installButton.addClass('frame_toolbar_btn_Disabled');

  $curProject.data('install', true);
}

// 结束子进程
function killChildProcess(projectDir) {
  let storage = Common.getLocalStorage();

  if (storage && storage['projects'][projectDir] && storage['projects'][projectDir]['pid']) {

    try {
      if (Common.PLATFORM === 'win32') {
        childProcess.exec('taskkill /pid ' + storage['projects'][projectDir]['pid'] + ' /T /F');
      } else {
        process.kill(storage['projects'][projectDir]['pid']);
      }
    } catch (e) {
      console.log('pid not found');
    }

    storage['projects'][projectDir]['pid'] = 0;
    Common.setLocalStorage(storage);

    $('.js_project_item[data-project="' + projectDir + '"]').removeData('pid');
  }
}

function logReply (data, projectPath) {
  let originData = data;
  let projectDir = path.basename(projectPath);
  let curProjectPath = $curProject.attr('title');
  let sessionStorage = Common.getSessionStorage();
  data = data.replace(/\n/g, '<br/>');
  data = data.replace(/\[(.*?)\]/g, '[<span class="operation_stage_log_time">$1</span>]'); // 时间高亮
  data = data.replace(/\'(.*?)\'/g, '\'<span class="operation_stage_log_keyword">$1</span>\''); // 单引号内的关键词高亮
  if (projectPath === curProjectPath) {
    $logContent.append(`${data}`);
    $logContent.scrollTop($logContent.get(0).scrollHeight);
  }

  // 把 log 写入 sessionStorage
  sessionStorage['projects'][projectDir]['log'] += data;
  Common.setSessionStorage(sessionStorage);

  // gulp 运行消息通知
  let localStorage = Common.getLocalStorage();
  // gulp 运行失败通知
  if (originData.match(/error/i)) {
    if (localStorage['setting']['gulp']['statusIcon'] === 'true') {
      mainProcess.emit('gulp', 'error');
    }
    if (localStorage['setting']['gulp']['notification'] === 'true') {
      Common.postNotification('gulp 任务失败', '详细情况请查看 Log');
    }
  }
  // 暂时先不实现成功与开始通知
  // gulp 运行完成通知
  // if (originData.match(/Finished 'compass'/i)) {
  //   if (localStorage['setting']['compass']['statusIcon'] === 'true') {
  //     mainProcess.emit('compass', 'finish');
  //   }
  //   if (localStorage['setting']['compass']['notification'] === 'true') {
  //     Common.postNotification('Compass 编译完成', '样式已经输出');
  //   }
  // }
  // // gulp 运行开始通知（仅有状态栏通知）
  // if (originData.match(/Starting 'compass'/i)) {
  //   if (localStorage['setting']['compass']['statusIcon'] === 'true') {
  //     mainProcess.emit('compass', 'starting');
  //   }
  // }
}

function runDevTask(projectPath, task) {
  let child;
  let cwd = projectPath;
  let startTipText; // 任务启动时的 Log，避免 Gulp 任务响应慢时需要等待一段时间才看到反馈

  if (task === 'default') {
    startTipText = '开启 Gulp 服务...';
  } else if (task === 'clean') {
    startTipText = '开启清理已编译文件...';
  } else if (task === 'install') {
    startTipText = '开始为该项目安装所需的依赖包...';
  }
  logReply(logTextWithDate(startTipText), projectPath);

  if (Common.PLATFORM === 'win32') {
    if (task === 'install') {
      child = childProcess.exec('npm install', {'cwd': cwd, silent: true});
    } else {
      child = childProcess.exec(`${localGulpBin} ` + task, {'cwd': cwd, silent: true});
    }
  } else {
    if (task === 'install') {
      child = childProcess.spawn('npm', [task], {env: {'PATH':'/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'}, cwd: cwd});
    } else {
      child = childProcess.spawn(`${localGulpBin}`, [task], {env: {'PATH':'/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'}, cwd: cwd, silent: true});
    }
  }
  console.log(child.pid);

  child.stdout.setEncoding('utf-8');
  child.stdout.on('data', function (data) {
    console.log(data);
    logReply(data.toString(), projectPath);
  });

  child.stderr.on('data', function (data) {
    console.log(data)
    logReply(data.toString(), projectPath);
  });

  child.on('close', function (code) {
    console.log(code);
    if (code && code !== 0) {
      logReply(`child process exited with code ${code}`, projectPath);
    }

    let tipText;
    if (task === 'default') {
      // Gulp 服务进程结束处理
      if (closeGulpManually) {
        closeGulpManually = false;
        tipText = '已关闭 Gulp 服务';
        logReply(logTextWithDate(tipText), projectPath);
      } else {
        tipText = 'Gulp 进程意外关闭，请重新启动服务';
        // 意外关闭的进程并没有进入正常的流程，因此需要手动更新 storage 和 UI 表现
        let $project = $('.js_project_item[data-pid="' + this.pid + '"]');
        $project.removeClass('project_stage_item_Watching');
        $project.data('default', false);

        let storage = Common.getLocalStorage();
        storage['projects'][projectDir]['pid'] = 0;
        Common.setLocalStorage(storage);

        if (projectDir === $curProject.data('project')) {
          $gulpButton.removeClass('frame_toolbar_btn_Watching');
          $gulpButton.text('开启 Gulp 服务');
        }
        logReply(logTextWithDate(tipText), projectPath);

        // 改变状态栏图标
        mainProcess.emit('closeGulp');
        // 发出通知
        let projectName = $project.data('name');
        Common.postNotification('Gulp 意外停止工作', '项目 ' + projectName + ' (' + projectDir + ') 的 Gulp 服务停止工作，请重新启动');
      }
    } else if (task === 'install') {
      // 安装依赖包进程结束处理
      // 按照进程 pid 确定项目，然后手动更新 storage 和 UI 表现
      let $project = $('.js_project_item[data-pid="' + this.pid + '"]');
      $project.data('install', false);

      let storage = Common.getLocalStorage();
      storage['projects'][projectDir]['pid'] = 0;
      Common.setLocalStorage(storage);

      if (projectDir === $curProject.data('project')) {
        $installButton.removeClass('frame_toolbar_btn_Disabled');
      }

      if (code && code !== 0) {
        // 出错处理
        tipText = '安装依赖包进程意外停止，请检查 NPM 和 Github 等环境后重新启动';
        logReply(logTextWithDate(tipText), projectPath);
        // 改变状态栏图标
        mainProcess.emit('closeGulp');
        // 发出通知
        let projectName = $project.data('name');
        Common.postNotification('安装依赖包进程意外停止', '项目 ' + projectName + ' (' + projectDir + ') 安装依赖包进程意外停止，请检查 NPM 和 Github 等环境后重新启动');
      } else {
        // 成功处理
        if (projectDir === $curProject.data('project')) {
          $gulpButton.removeClass('qw_hide');
          $cleanButton.removeClass('qw_hide');
          $installButton.addClass('qw_hide');
        }
        tipText = '依赖包安装完毕，可以开始启用 gulp 服务';
        logReply(logTextWithDate(tipText), projectPath);
      }
    }
  });

  let storage = Common.getLocalStorage();
  let projectDir = $curProject.data('project');

  if (storage && storage['projects'] && storage['projects'][projectDir]) {
    if (task === 'default') {
      console.log(child.pid);
      storage['projects'][projectDir]['pid'] = child.pid;
      Common.setLocalStorage(storage);

      $curProject.attr('data-pid', child.pid);

      setGulpBtnWatching();

    } else if (task === 'install') {
      setInstallBtnInstalling();
    }
  }
}

function runTaskOnCurrentProject (task) {
    let projectDir = $curProject.data('project');
    let storage = Common.getLocalStorage();
    if (storage && storage['projects'] && storage['projects'][projectDir]) {
      runDevTask(storage['projects'][projectDir]['path'], task);
    }
}

$installButton.on('click', function() {
  if (!$curProject.data('install')) {
    runTaskOnCurrentProject('install');
  }
});

$gulpButton.on('click', function() {

  let projectDir = $curProject.data('project');

  if ($curProject.data('default')) {
    closeGulpManually = true;
    killChildProcess(projectDir);
    setGulpBtnNormal();
  } else {
    runTaskOnCurrentProject('default');
  }
});

$cleanButton.on('click', function() {

  runTaskOnCurrentProject('clean');
});

// 关于
function showAbout() {
  const BrowserWindow = remote.BrowserWindow;

  let win = new BrowserWindow({
    width: 320,
    height: 300,
    resizable: false,
    title: '关于'
  });
  // win.webContents.openDevTools();

  let aboutPath = 'file://' + __dirname + '/about.html';
  win.loadURL(aboutPath);

  win.on('closed', function () {
    win = null;
  });
}

// 调试

// 重置储存数据
function resetAppStorage() {
  $.prompt('重置储存数据会清空本 App 中所有的相关数据，包括项目数据。', {
    title: '确认重置储存数据',
    buttons: { '确认': true, '取消': false },
    submit: function(e,v,m,f) {
      if (v) {
        Common.resetLocalStorage();
        Common.resetSessionStorage();
        remote.getCurrentWindow().reload();
      }
    }
  });
}

// 工具方法

// 时间格式
function dateFormat(date) {
  if (date.toString().length == 1) {
    return '0' + date;
  }
  return date;
}

// 生成带时间的 Log
function logTextWithDate(content) {
  let D = new Date();
  let h = dateFormat(D.getHours());
  let m = dateFormat(D.getMinutes());
  let s = dateFormat(D.getSeconds());
  return `[${h}:${m}:${s}] ${content}<br/>`;
}

// 交换两个 DOM 顺序
function togglePostion(a, b) {
  var temp1 = $('<div id="a1"></div>').insertBefore(a),
      temp2 = $('<div id="b1"></div>').insertBefore(b);

  a.insertAfter(temp2);
  b.insertAfter(temp1);
  temp1.remove();
  temp2.remove();
  temp1 = temp2 = null;
}
